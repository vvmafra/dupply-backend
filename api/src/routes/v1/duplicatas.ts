import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import type { AppConfig } from "../../config.js";
import type { Db } from "../../db/index.js";
import { duplicataChainRecords, duplicataDrafts } from "../../db/schema.js";
import {
  confirmDuplicataBodySchema,
  createDuplicataBodySchema,
  DomainError,
  validateIssueInvariants,
} from "../../domain/duplicata/dto.js";
import { bodyToIssuePayload } from "../../domain/duplicata/map-issue-payload.js";
import type { Duplicata } from "../../generated/duplicata-registry-contract.js";
import { parseSuccessfulIssueTx, TxFailedError, TxNotFoundError } from "../../integrations/registry/confirm-tx.js";
import {
  createRegistryClient,
  DomainValidationError,
  IssueSimulationError,
  IssuerNotAllowedError,
  RegistryConfigError,
  simulateIssue,
} from "../../integrations/registry/issue-flow.js";

function nowMs(): string {
  return String(Date.now());
}

function bufToHex(b: Buffer): string {
  return Buffer.from(b).toString("hex");
}

function serializeDuplicata(d: Duplicata): Record<string, unknown> {
  return {
    ...d,
    numero_duplicata_hash: bufToHex(d.numero_duplicata_hash),
    numero_fatura_hash: bufToHex(d.numero_fatura_hash),
    doc_fiscal_chave_hash: bufToHex(d.doc_fiscal_chave_hash),
    sacado_commitment: bufToHex(d.sacado_commitment),
    valor_face_centavos: d.valor_face_centavos.toString(),
    valor_max_antecipacao_centavos: d.valor_max_antecipacao_centavos.toString(),
    data_emissao_unix: d.data_emissao_unix.toString(),
    data_vencimento_unix: d.data_vencimento_unix.toString(),
    id: d.id.toString(),
    issued_at: d.issued_at.toString(),
  };
}

export async function registerDuplicataRoutes(
  app: FastifyInstance,
  deps: { db: Db; config: AppConfig },
): Promise<void> {
  const { db, config } = deps;

  app.post("/v1/duplicatas", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config.DUPPLY_REGISTRY_CONTRACT_ID) {
      return reply.code(503).send({ error: "DUPPLY_REGISTRY_CONTRACT_ID not configured" });
    }
    const parsed = createDuplicataBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    try {
      validateIssueInvariants(body);
      const payload = bodyToIssuePayload(body);
      const sim = await simulateIssue(config, body.issuerPublicKey, payload);
      const id = randomUUID();
      const t = nowMs();
      await db.insert(duplicataDrafts).values({
        id,
        issuerPublicKey: body.issuerPublicKey,
        status: "simulated",
        payloadJson: JSON.stringify(body),
        unsignedXdr: sim.unsignedXdr,
        assembledJson: sim.assembledJson,
        simulationLedger: sim.simulationLedger,
        predictedChainId: sim.predictedChainId,
        lastError: null,
        createdAtMs: t,
        updatedAtMs: t,
      });
      return reply.send({
        id,
        status: "simulated",
        issuerPublicKey: body.issuerPublicKey,
        unsignedTransactionXdr: sim.unsignedXdr,
        predictedChainDuplicataId: sim.predictedChainId,
        simulationLedger: sim.simulationLedger,
      });
    } catch (e) {
      if (e instanceof DomainError) {
        return reply.code(400).send({ error: e.code, message: e.message });
      }
      if (e instanceof DomainValidationError) {
        return reply.code(400).send({ error: "invalid_issuer", message: e.message });
      }
      if (e instanceof IssuerNotAllowedError) {
        return reply.code(403).send({ error: "IssuerNotAllowed", message: e.message });
      }
      if (e instanceof RegistryConfigError) {
        return reply.code(503).send({ error: "registry_config", message: e.message });
      }
      if (e instanceof IssueSimulationError) {
        return reply.code(502).send({
          error: "simulation_failed",
          message: e.message,
          simulation: e.simulation,
        });
      }
      throw e;
    }
  });

  app.post("/v1/duplicatas/:id/confirm", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config.DUPPLY_REGISTRY_CONTRACT_ID) {
      return reply.code(503).send({ error: "DUPPLY_REGISTRY_CONTRACT_ID not configured" });
    }
    const draftId = (request.params as { id: string }).id;
    const parsed = confirmDuplicataBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const { txHash } = parsed.data;

    const [draft] = await db.select().from(duplicataDrafts).where(eq(duplicataDrafts.id, draftId)).limit(1);
    if (!draft) {
      return reply.code(404).send({ error: "draft_not_found" });
    }
    if (draft.status === "confirmed") {
      const [existing] = await db
        .select()
        .from(duplicataChainRecords)
        .where(eq(duplicataChainRecords.draftId, draftId))
        .limit(1);
      return reply.send({
        id: draftId,
        status: "confirmed",
        chain: existing ?? null,
      });
    }

    const [dupTx] = await db
      .select()
      .from(duplicataChainRecords)
      .where(eq(duplicataChainRecords.txHash, txHash))
      .limit(1);
    if (dupTx) {
      return reply.code(409).send({ error: "tx_hash_already_confirmed", chainRecordId: dupTx.id });
    }

    try {
      const parsedTx = await parseSuccessfulIssueTx(config.SOROBAN_RPC_URL, txHash);
      const recordId = randomUUID();
      const t = nowMs();
      try {
        await db.insert(duplicataChainRecords).values({
          id: recordId,
          draftId,
          network: config.STELLAR_NETWORK,
          contractId: config.DUPPLY_REGISTRY_CONTRACT_ID,
          chainDuplicataId: parsedTx.chainDuplicataId,
          txHash,
          ledger: parsedTx.ledger,
          issuedAtLedger: parsedTx.issuedAtUnix,
          createdAtMs: t,
        });
      } catch (insErr: unknown) {
        const msg = insErr instanceof Error ? insErr.message : String(insErr);
        if (msg.includes("UNIQUE constraint failed")) {
          return reply.code(409).send({ error: "duplicate_chain_duplicata_id" });
        }
        throw insErr;
      }
      await db
        .update(duplicataDrafts)
        .set({
          status: "confirmed",
          updatedAtMs: t,
          lastError: null,
        })
        .where(eq(duplicataDrafts.id, draftId));
      return reply.send({
        id: draftId,
        status: "confirmed",
        chain: {
          id: recordId,
          chainDuplicataId: parsedTx.chainDuplicataId,
          txHash,
          ledger: parsedTx.ledger,
          issuedAtLedger: parsedTx.issuedAtUnix,
          network: config.STELLAR_NETWORK,
          contractId: config.DUPPLY_REGISTRY_CONTRACT_ID,
        },
      });
    } catch (e) {
      if (e instanceof TxNotFoundError) {
        const t = nowMs();
        await db
          .update(duplicataDrafts)
          .set({ status: "failed", updatedAtMs: t, lastError: e.message })
          .where(eq(duplicataDrafts.id, draftId));
        return reply.code(404).send({ error: "tx_not_found", message: e.message });
      }
      if (e instanceof TxFailedError) {
        const t = nowMs();
        await db
          .update(duplicataDrafts)
          .set({ status: "failed", updatedAtMs: t, lastError: e.detail })
          .where(eq(duplicataDrafts.id, draftId));
        return reply.code(400).send({ error: "tx_failed", detail: e.detail });
      }
      throw e;
    }
  });

  app.get("/v1/duplicatas/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const draftId = (request.params as { id: string }).id;
    const [draft] = await db.select().from(duplicataDrafts).where(eq(duplicataDrafts.id, draftId)).limit(1);
    if (!draft) {
      return reply.code(404).send({ error: "not_found" });
    }
    const [chain] = await db
      .select()
      .from(duplicataChainRecords)
      .where(eq(duplicataChainRecords.draftId, draftId))
      .limit(1);
    return reply.send({
      draft: {
        id: draft.id,
        issuerPublicKey: draft.issuerPublicKey,
        status: draft.status,
        payload: safeJson(draft.payloadJson),
        predictedChainDuplicataId: draft.predictedChainId,
        simulationLedger: draft.simulationLedger,
        lastError: draft.lastError,
        createdAtMs: draft.createdAtMs,
        updatedAtMs: draft.updatedAtMs,
      },
      chain: chain
        ? {
            id: chain.id,
            chainDuplicataId: chain.chainDuplicataId,
            txHash: chain.txHash,
            ledger: chain.ledger,
            issuedAtLedger: chain.issuedAtLedger,
            network: chain.network,
            contractId: chain.contractId,
          }
        : null,
    });
  });

  app.get("/v1/duplicatas/on-chain/:chainId", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config.DUPPLY_REGISTRY_CONTRACT_ID) {
      return reply.code(503).send({ error: "DUPPLY_REGISTRY_CONTRACT_ID not configured" });
    }
    const chainId = (request.params as { chainId: string }).chainId;
    if (!/^\d+$/.test(chainId)) {
      return reply.code(400).send({ error: "invalid_chain_id" });
    }
    const issuer = (request.query as { issuer?: string }).issuer;
    if (typeof issuer !== "string" || issuer.length < 5) {
      return reply.code(400).send({ error: "issuer_query_required" });
    }
    try {
      const client = createRegistryClient(config, issuer);
      const tx = await client.get_duplicata({ id: BigInt(chainId) });
      await tx.simulate();
      const d = tx.result;
      return reply.send({
        chainDuplicataId: chainId,
        duplicata: d ? serializeDuplicata(d) : null,
      });
    } catch (e) {
      if (e instanceof DomainValidationError) {
        return reply.code(400).send({ error: "invalid_issuer", message: e.message });
      }
      if (e instanceof RegistryConfigError) {
        return reply.code(503).send({ error: "registry_config", message: e.message });
      }
      if (e instanceof AssembledTransaction.Errors.SimulationFailed) {
        return reply.code(502).send({ error: "simulation_failed", message: e.message });
      }
      throw e;
    }
  });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
