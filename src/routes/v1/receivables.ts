import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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

const createBodySchema = z.object({
  payerUserId: z.string().uuid(),
  value: z.string().min(1),
  receivableMd: z.string().optional(),
});

const riskDecisionBodySchema = z.object({
  decision: z.enum(["offer", "reject"]),
  proposedValue: z.string().min(1).optional(),
});

function requireAuth(request: FastifyRequest, reply: FastifyReply): request is FastifyRequest & { auth: NonNullable<FastifyRequest["auth"]> } {
  if (!request.auth) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

function isStaffRole(role: string): boolean {
  return (
    role === PLATFORM_ROLES.ADMIN ||
    role === PLATFORM_ROLES.RISK_ANALYST ||
    role === PLATFORM_ROLES.RISK_ANALYST_AGENT
  );
}

function platformRole(auth: NonNullable<FastifyRequest["auth"]>): PlatformRole {
  return auth.role as PlatformRole;
}

function canViewReceivable(
  auth: NonNullable<FastifyRequest["auth"]>,
  row: { sellerUserId: string; payerUserId: string },
): boolean {
  const role = platformRole(auth);
  if (role === PLATFORM_ROLES.SELLER && row.sellerUserId === auth.sub) {
    return true;
  }
  if (role === PLATFORM_ROLES.PAYER && row.payerUserId === auth.sub) {
    return true;
  }
  if (isStaffRole(role)) {
    return true;
  }
  return false;
}

export async function registerReceivableRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const { db } = deps;

  app.get(
    "/v1/receivables",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(request, reply)) return;
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

  app.get(
    "/v1/receivables/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(request, reply)) return;
      const id = (request.params as { id: string }).id;
      const [row] = await db.select().from(receivables).where(eq(receivables.id, id)).limit(1);
      if (!row) {
        return reply.code(404).send({ error: "not_found" });
      }
      if (!canViewReceivable(request.auth!, row)) {
        return reply.code(403).send({ error: "forbidden" });
      }
      return { receivable: row };
    },
  );

  app.post(
    "/v1/receivables",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(request, reply)) return;
      const { auth } = request;
      if (auth.role !== PLATFORM_ROLES.SELLER) {
        return reply.code(403).send({ error: "forbidden" });
      }
      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }
      try {
        const { id } = await executeCreateReceivable(deps, {
          sellerUserId: auth.sub,
          payerUserId: parsed.data.payerUserId,
          value: parsed.data.value,
          receivableMd: parsed.data.receivableMd,
        });
        return reply.code(201).send({ id });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "error";
        if (msg === "seller_and_payer_must_differ") {
          return reply.code(400).send({ error: msg });
        }
        if (msg === "invalid_seller" || msg === "invalid_payer") {
          return reply.code(400).send({ error: msg });
        }
        throw e;
      }
    },
  );

  app.post(
    "/v1/receivables/:id/risk-decision",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(request, reply)) return;
      const { auth } = request;
      const role = platformRole(auth);
      if (role !== PLATFORM_ROLES.RISK_ANALYST && role !== PLATFORM_ROLES.RISK_ANALYST_AGENT) {
        return reply.code(403).send({ error: "forbidden" });
      }
      const id = (request.params as { id: string }).id;
      const parsed = riskDecisionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }
      try {
        await executeRiskDecision(deps, {
          receivableId: id,
          actorRole: role,
          decision: parsed.data.decision,
          proposedValue: parsed.data.proposedValue,
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) {
          return reply.code(409).send({ error: e.message });
        }
        const msg = e instanceof Error ? e.message : "error";
        if (msg === "receivable_not_found") {
          return reply.code(404).send({ error: msg });
        }
        if (msg === "invalid_status_for_risk_decision" || msg === "proposed_value_required_for_offer") {
          return reply.code(400).send({ error: msg });
        }
        throw e;
      }
    },
  );

  app.post(
    "/v1/receivables/:id/confirm",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(request, reply)) return;
      const { auth } = request;
      if (platformRole(auth) !== PLATFORM_ROLES.PAYER) {
        return reply.code(403).send({ error: "forbidden" });
      }
      const id = (request.params as { id: string }).id;
      try {
        await executePayerConfirm(deps, { receivableId: id, payerUserId: auth.sub });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) {
          return reply.code(409).send({ error: e.message });
        }
        const msg = e instanceof Error ? e.message : "error";
        if (msg === "receivable_not_found") {
          return reply.code(404).send({ error: msg });
        }
        if (msg === "payer_mismatch") {
          return reply.code(403).send({ error: msg });
        }
        throw e;
      }
    },
  );
}
