import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import {
  executeCreateReceivable,
  executePayerConfirm,
  executeRiskDecision,
} from "../../application/receivable/commands/receivableCommands.js";
import { PLATFORM_ROLES, type PlatformRole } from "../../domain/receivable/transitions.js";
import { receivables } from "../../db/schema.runtime.js";
import { ReceivableTransitionError } from "../../domain/receivable/transitions.js";
import { SellerError, SELLER_ERROR_CODES } from "../../domain/seller/errors.js";
import { requireRoles } from "../../plugins/require-roles.js";

const createBodySchema = z.object({
  payerUserId: z.string().uuid(),
  value: z.string().min(1),
  receivableMd: z.string().optional(),
});

const riskDecisionBodySchema = z.object({
  decision: z.enum(["offer", "reject"]),
  proposedValue: z.string().min(1).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

function isStaffRole(role: string): boolean {
  return (
    role === PLATFORM_ROLES.ADMIN ||
    role === PLATFORM_ROLES.RISK_ANALYST ||
    role === PLATFORM_ROLES.RISK_ANALYST_AGENT
  );
}

function platformRole(auth: { role: string }): PlatformRole {
  return auth.role as PlatformRole;
}

function canViewReceivable(
  auth: { sub: string; role: string },
  row: { sellerUserId: string; payerUserId: string },
): boolean {
  const role = platformRole(auth);
  if (role === PLATFORM_ROLES.SELLER && row.sellerUserId === auth.sub) return true;
  if (role === PLATFORM_ROLES.PAYER && row.payerUserId === auth.sub) return true;
  if (isStaffRole(role)) return true;
  return false;
}

export async function registerReceivableRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const { db } = deps;
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    "/v1/receivables",
    {
      schema: {
        tags: ["Receivables"],
        summary: "Listar recebíveis do usuário autenticado",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      const { auth } = request;
      const role = platformRole(auth);
      let rows;
      if (role === PLATFORM_ROLES.SELLER) {
        rows = await db.select().from(receivables).where(eq(receivables.sellerUserId, auth.sub));
      } else if (role === PLATFORM_ROLES.PAYER) {
        rows = await db.select().from(receivables).where(eq(receivables.payerUserId, auth.sub));
      } else if (isStaffRole(role)) {
        rows = await db.select().from(receivables).limit(200);
      } else {
        return reply.code(403).send({ error: "forbidden" });
      }
      return { receivables: rows };
    },
  );

  api.get(
    "/v1/receivables/:id",
    {
      schema: {
        tags: ["Receivables"],
        summary: "Buscar recebível por ID",
        params: idParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      const [row] = await db
        .select()
        .from(receivables)
        .where(eq(receivables.id, request.params.id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: "not_found" });
      if (!canViewReceivable(request.auth, row)) {
        return reply.code(403).send({ error: "forbidden" });
      }
      return { receivable: row };
    },
  );

  api.post(
    "/v1/receivables",
    {
      preHandler: requireRoles("seller"),
      schema: {
        tags: ["Receivables"],
        summary: "Criar recebível (seller)",
        body: createBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = request.auth!;
      try {
        const { id } = await executeCreateReceivable(deps, {
          sellerUserId: auth.sub,
          payerUserId: request.body.payerUserId,
          value: request.body.value,
          receivableMd: request.body.receivableMd,
        });
        return reply.code(201).send({ id });
      } catch (e) {
        if (e instanceof SellerError && e.code === SELLER_ERROR_CODES.NOT_ACTIVE) {
          return reply.code(403).send({ error: "seller_not_active" });
        }
        const msg = e instanceof Error ? e.message : "error";
        if (msg === "seller_and_payer_must_differ") return reply.code(400).send({ error: msg });
        if (msg === "invalid_seller" || msg === "invalid_payer") return reply.code(400).send({ error: msg });
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
        summary: "Decisão de risco (risk_analyst)",
        params: idParamsSchema,
        body: riskDecisionBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const role = platformRole(request.auth!);
      try {
        await executeRiskDecision(deps, {
          receivableId: request.params.id,
          actorRole: role,
          decision: request.body.decision,
          proposedValue: request.body.proposedValue,
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) return reply.code(409).send({ error: e.message });
        const msg = e instanceof Error ? e.message : "error";
        if (msg === "receivable_not_found") return reply.code(404).send({ error: msg });
        if (msg === "invalid_status_for_risk_decision" || msg === "proposed_value_required_for_offer") {
          return reply.code(400).send({ error: msg });
        }
        throw e;
      }
    },
  );

  api.post(
    "/v1/receivables/:id/confirm",
    {
      preHandler: requireRoles("payer"),
      schema: {
        tags: ["Receivables"],
        summary: "Confirmar recebível (payer)",
        params: idParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = request.auth!;
      try {
        await executePayerConfirm(deps, { receivableId: request.params.id, payerUserId: auth.sub });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) return reply.code(409).send({ error: e.message });
        const msg = e instanceof Error ? e.message : "error";
        if (msg === "receivable_not_found") return reply.code(404).send({ error: msg });
        if (msg === "payer_mismatch") return reply.code(403).send({ error: msg });
        throw e;
      }
    },
  );
}
