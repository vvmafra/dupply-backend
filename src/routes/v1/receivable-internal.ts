import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeSystemAdvanceSettlement } from "../../application/receivable/commands/systemAdvanceSettlementCommand.js";
import { executeSystemPayerSettlement } from "../../application/receivable/commands/systemPayerSettlementCommand.js";
import { RECEIVABLE_STATUS, ReceivableTransitionError } from "../../domain/receivable/transitions.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../domain/receivable/errors.js";

const advanceBodySchema = z.object({
  targetStatus: z.enum([RECEIVABLE_STATUS.PROCESSING, RECEIVABLE_STATUS.COMPLETED]),
});

const payerSettlementBodySchema = z.object({
  outcome: z.enum(["settled", "overdue"]),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Settlement advances — **Dupply API key only** (workers / BFF).
 */
export async function registerReceivableInternalRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/internal/receivables/:id/advance-settlement",
    {
      schema: {
        tags: ["Internal"],
        summary: "Advance receivable settlement (worker)",
        hide: true,
        params: idParamsSchema,
        body: advanceBodySchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      try {
        await executeSystemAdvanceSettlement(deps, {
          receivableId: request.params.id,
          targetStatus: request.body.targetStatus,
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) {
          return reply.code(409).send({ error: e.message });
        }
        if (e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.NOT_FOUND) {
          return reply.code(404).send({ error: e.code });
        }
        throw e;
      }
    },
  );

  api.post(
    "/v1/internal/receivables/:id/payer-settlement",
    {
      schema: {
        tags: ["Internal"],
        summary: "Mark payer settlement outcome (worker)",
        hide: true,
        params: idParamsSchema,
        body: payerSettlementBodySchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      try {
        await executeSystemPayerSettlement(deps, {
          receivableId: request.params.id,
          outcome: request.body.outcome,
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) {
          return reply.code(409).send({ error: e.message });
        }
        if (e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.NOT_FOUND) {
          return reply.code(404).send({ error: e.code });
        }
        const msg = e instanceof Error ? e.message : "error";
        if (msg === "invalid_payer_settlement_transition") {
          return reply.code(400).send({ error: msg });
        }
        throw e;
      }
    },
  );
}
