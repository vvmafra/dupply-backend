import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../../compose/deps.js";
import {
  confirmTradeBillBodySchema,
  createTradeBillBodySchema,
  DomainError,
} from "../domain/tradeBill/dto.js";
import {
  DuplicateChainBillIdError,
  DraftNotFoundError,
  executeConfirmTradeBill,
  TxHashAlreadyConfirmedError,
} from "../application/commands/confirmTradeBillCommand.js";
import {
  executeSimulateTradeBill,
  RegistryNotConfiguredError,
} from "../application/commands/simulateTradeBillCommand.js";
import { executeGetOnChainTradeBill } from "../application/queries/getOnChainTradeBillQuery.js";
import {
  executeGetTradeBill,
  TradeBillNotFoundError,
} from "../application/queries/getTradeBillQuery.js";
import {
  DomainValidationError,
  IssuerNotAllowedError,
  IssueSimulationError,
  RegistryConfigError,
  TxFailedError,
  TxNotFoundError,
} from "../application/registryErrors.js";

const draftIdParamsSchema = z.object({ id: z.string().min(1) });
const onChainParamsSchema = z.object({ chainId: z.string().regex(/^\d+$/) });
const onChainQuerySchema = z.object({ issuer: z.string().min(5) });

export async function registerTradeBillRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/trade-bills",
    {
      schema: {
        tags: ["Trade Bills"],
        summary: "Simular emissão de duplicata on-chain",
        body: createTradeBillBodySchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      try {
        const result = await executeSimulateTradeBill(deps, request.body);
        return reply.send(result);
      } catch (e) {
        if (e instanceof RegistryNotConfiguredError) {
          return reply.code(503).send({ error: "DUPPLY_REGISTRY_CONTRACT_ID not configured" });
        }
        if (e instanceof DomainError) return reply.code(400).send({ error: e.code, message: e.message });
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
    },
  );

  api.post(
    "/v1/trade-bills/:id/confirm",
    {
      schema: {
        tags: ["Trade Bills"],
        summary: "Confirmar duplicata após assinatura on-chain",
        params: draftIdParamsSchema,
        body: confirmTradeBillBodySchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      try {
        const result = await executeConfirmTradeBill(deps, {
          draftId: request.params.id,
          txHash: request.body.txHash,
        });
        return reply.send(result);
      } catch (e) {
        if (e instanceof RegistryNotConfiguredError) {
          return reply.code(503).send({ error: "DUPPLY_REGISTRY_CONTRACT_ID not configured" });
        }
        if (e instanceof DraftNotFoundError) {
          return reply.code(404).send({ error: "draft_not_found" });
        }
        if (e instanceof TxHashAlreadyConfirmedError) {
          return reply.code(409).send({
            error: "tx_hash_already_confirmed",
            chainRecordId: e.chainRecordId,
          });
        }
        if (e instanceof DuplicateChainBillIdError) {
          return reply.code(409).send({ error: "duplicate_chain_bill_id" });
        }
        if (e instanceof TxNotFoundError) {
          return reply.code(404).send({ error: "tx_not_found", message: e.message });
        }
        if (e instanceof TxFailedError) {
          return reply.code(400).send({ error: "tx_failed", detail: e.detail });
        }
        throw e;
      }
    },
  );

  api.get(
    "/v1/trade-bills/:id",
    {
      schema: {
        tags: ["Trade Bills"],
        summary: "Buscar rascunho de duplicata por ID",
        params: draftIdParamsSchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      try {
        return await executeGetTradeBill(deps, request.params.id);
      } catch (e) {
        if (e instanceof TradeBillNotFoundError) {
          return reply.code(404).send({ error: "not_found" });
        }
        throw e;
      }
    },
  );

  api.get(
    "/v1/trade-bills/on-chain/:chainId",
    {
      schema: {
        tags: ["Trade Bills"],
        summary: "Buscar duplicata on-chain por chainId",
        params: onChainParamsSchema,
        querystring: onChainQuerySchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      try {
        return await executeGetOnChainTradeBill(deps, {
          chainId: request.params.chainId,
          issuer: request.query.issuer,
        });
      } catch (e) {
        if (e instanceof RegistryNotConfiguredError) {
          return reply.code(503).send({ error: "DUPPLY_REGISTRY_CONTRACT_ID not configured" });
        }
        if (e instanceof DomainValidationError) {
          return reply.code(400).send({ error: "invalid_issuer", message: e.message });
        }
        if (e instanceof RegistryConfigError) {
          return reply.code(503).send({ error: "registry_config", message: e.message });
        }
        if (e instanceof IssueSimulationError) {
          return reply.code(502).send({ error: "simulation_failed", message: e.message });
        }
        throw e;
      }
    },
  );
}
