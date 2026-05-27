import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeCreateAndSubmitReceivable } from "../../application/receivable/commands/createAndSubmitReceivableCommand.js";
import { executeCreateReceivable } from "../../application/receivable/commands/createReceivableCommand.js";
import { executeRiskDecision } from "../../application/receivable/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../application/receivable/commands/sellerDecisionCommand.js";
import { executeSubmitReceivable } from "../../application/receivable/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../application/receivable/commands/updateReceivableDraftCommand.js";
import { executeGetReceivable } from "../../application/receivable/queries/getReceivableQuery.js";
import { executeListReceivables } from "../../application/receivable/queries/listReceivablesQuery.js";
import type { AccountRole } from "../../domain/account/types.js";
import {
  RECEIVABLE_ERROR_CODES,
  ReceivableError,
  type ReceivableErrorCode,
} from "../../domain/receivable/errors.js";
import { ReceivableTransitionError } from "../../domain/receivable/transitions.js";
import { SELLER_ERROR_CODES, SellerError } from "../../domain/seller/errors.js";
import { requireRoles } from "../../plugins/require-roles.js";

const receivableMetaDataSchema = z
  .object({
    type: z.enum(["commercial", "service"]).optional(),
    billNumber: z.string().optional(),
    invoiceNumber: z.string().optional(),
    issuedAt: z.string().optional(),
    dueDate: z.string().optional(),
    payerCnpj: z.string().optional(),
    payerLegalName: z.string().optional(),
    payerFinancialEmail: z.string().optional(),
    fiscalDocumentType: z.enum(["nfe", "nfce", "nfse", "other"]).optional(),
    fiscalDocumentKey: z.string().optional(),
    proofType: z.enum(["delivery", "acceptance", "service_provision"]).optional(),
    payerAcceptanceStatus: z.enum(["accepted", "pending", "refused"]).optional(),
    desiredAnticipationValue: z.number().positive().multipleOf(0.01).optional(),
    antifraudDeclarationsAccepted: z.boolean().optional(),
  })
  .optional();

const createBodySchema = z.object({
  payerCnpj: z.string().min(1),
  payerLegalName: z.string().min(1).optional(),
  payerFinancialEmail: z.string().email().optional(),
  value: z.number().nonnegative().multipleOf(0.01).optional(),
  receivableMetaData: receivableMetaDataSchema,
});

const updateBodySchema = z.object({
  value: z.number().nonnegative().multipleOf(0.01).optional(),
  receivableMetaData: receivableMetaDataSchema,
});

const riskDecisionBodySchema = z.object({
  decision: z.enum(["offer", "reprove"]),
  proposedValue: z.number().positive().multipleOf(0.01).optional(),
});

const sellerDecisionBodySchema = z.object({
  decision: z.enum(["accept", "reject"]),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

const RECEIVABLE_ERROR_HTTP: Partial<Record<ReceivableErrorCode, number>> = {
  [RECEIVABLE_ERROR_CODES.NOT_FOUND]: 404,
  [RECEIVABLE_ERROR_CODES.FORBIDDEN]: 403,
  [RECEIVABLE_ERROR_CODES.NOT_OWNER]: 403,
  [RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA]: 400,
  [RECEIVABLE_ERROR_CODES.SELLER_PAYER_MUST_DIFFER]: 400,
  [RECEIVABLE_ERROR_CODES.PROPOSED_VALUE_REQUIRED]: 400,
  [RECEIVABLE_ERROR_CODES.PROPOSED_VALUE_FORBIDDEN]: 400,
  [RECEIVABLE_ERROR_CODES.METADATA_LOCKED]: 409,
  [RECEIVABLE_ERROR_CODES.SOFT_DELETED]: 409,
};

function mapReceivableError(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, error: ReceivableError) {
  const status = RECEIVABLE_ERROR_HTTP[error.code] ?? 400;
  return reply.code(status).send({ error: error.code });
}

export async function registerReceivableRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    "/v1/receivables",
    {
      schema: {
        tags: ["Receivables"],
        summary: "List receivables scoped by caller role",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        const rows = await executeListReceivables(deps, {
          profileId: request.auth.profileId,
          role: request.auth.role as AccountRole,
        });
        return { receivables: rows };
      } catch (e) {
        if (e instanceof ReceivableError) return mapReceivableError(reply, e);
        throw e;
      }
    },
  );

  api.get(
    "/v1/receivables/:id",
    {
      schema: {
        tags: ["Receivables"],
        summary: "Get receivable by ID",
        params: idParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        const receivable = await executeGetReceivable(deps, {
          receivableId: request.params.id,
          actor: {
            profileId: request.auth.profileId,
            role: request.auth.role as AccountRole,
          },
        });
        return { receivable };
      } catch (e) {
        if (e instanceof ReceivableError) return mapReceivableError(reply, e);
        throw e;
      }
    },
  );

  api.post(
    "/v1/receivables",
    {
      preHandler: requireRoles("seller"),
      schema: {
        tags: ["Receivables"],
        summary: "Create receivable draft (seller)",
        body: createBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = request.auth!;
      try {
        const { id } = await executeCreateReceivable(deps, {
          profileId: auth.profileId,
          payerCnpj: request.body.payerCnpj,
          payerLegalName: request.body.payerLegalName,
          payerFinancialEmail: request.body.payerFinancialEmail,
          value: request.body.value,
          receivableMetaData: request.body.receivableMetaData,
        });
        return reply.code(201).send({ id });
      } catch (e) {
        if (e instanceof SellerError && e.code === SELLER_ERROR_CODES.NOT_ACTIVE) {
          return reply.code(403).send({ error: "seller_not_active" });
        }
        if (e instanceof ReceivableError) return mapReceivableError(reply, e);
        throw e;
      }
    },
  );

  api.post(
    "/v1/receivables/submit",
    {
      preHandler: requireRoles("seller"),
      schema: {
        tags: ["Receivables"],
        summary: "Create and submit receivable for risk review in one step (seller)",
        body: createBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = request.auth!;
      try {
        const result = await executeCreateAndSubmitReceivable(deps, {
          profileId: auth.profileId,
          payerCnpj: request.body.payerCnpj,
          payerLegalName: request.body.payerLegalName,
          payerFinancialEmail: request.body.payerFinancialEmail,
          value: request.body.value,
          receivableMetaData: request.body.receivableMetaData,
          actorRole: auth.role,
        });
        return reply.code(201).send(result);
      } catch (e) {
        if (e instanceof SellerError && e.code === SELLER_ERROR_CODES.NOT_ACTIVE) {
          return reply.code(403).send({ error: "seller_not_active" });
        }
        if (e instanceof ReceivableError) return mapReceivableError(reply, e);
        throw e;
      }
    },
  );

  api.patch(
    "/v1/receivables/:id",
    {
      schema: {
        tags: ["Receivables"],
        summary: "Update receivable draft (seller, status=created only)",
        params: idParamsSchema,
        body: updateBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        await executeUpdateReceivableDraft(deps, {
          receivableId: request.params.id,
          profileId: request.auth.profileId,
          value: request.body.value,
          receivableMetaData: request.body.receivableMetaData,
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableError) return mapReceivableError(reply, e);
        throw e;
      }
    },
  );

  api.post(
    "/v1/receivables/:id/submit",
    {
      schema: {
        tags: ["Receivables"],
        summary: "Submit receivable for risk review (seller)",
        params: idParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        await executeSubmitReceivable(deps, {
          receivableId: request.params.id,
          profileId: request.auth.profileId,
          actorRole: request.auth.role,
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) {
          return reply.code(409).send({ error: e.message });
        }
        if (e instanceof ReceivableError) return mapReceivableError(reply, e);
        throw e;
      }
    },
  );

  api.post(
    "/v1/receivables/:id/risk-decision",
    {
      preHandler: requireRoles("risk_analyst", "risk_analyst_agent"),
      schema: {
        tags: ["Receivables"],
        summary: "Risk analyst decision on receivable",
        params: idParamsSchema,
        body: riskDecisionBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        await executeRiskDecision(deps, {
          receivableId: request.params.id,
          actorRole: request.auth!.role,
          decision: request.body.decision,
          proposedValue: request.body.proposedValue,
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) {
          return reply.code(409).send({ error: e.message });
        }
        if (e instanceof ReceivableError) return mapReceivableError(reply, e);
        throw e;
      }
    },
  );

  api.post(
    "/v1/receivables/:id/seller-decision",
    {
      schema: {
        tags: ["Receivables"],
        summary: "Seller accepts or rejects analyst offer",
        params: idParamsSchema,
        body: sellerDecisionBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        await executeSellerDecision(deps, {
          receivableId: request.params.id,
          profileId: request.auth.profileId,
          actorRole: request.auth.role,
          decision: request.body.decision,
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) {
          return reply.code(409).send({ error: e.message });
        }
        if (e instanceof ReceivableError) return mapReceivableError(reply, e);
        throw e;
      }
    },
  );
}
