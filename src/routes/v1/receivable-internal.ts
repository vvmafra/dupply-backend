import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeSystemAdvanceSettlement } from "../../application/receivable/commands/receivableCommands.js";
import { RECEIVABLE_STATUS, ReceivableTransitionError } from "../../domain/receivable/transitions.js";

const advanceBodySchema = z.object({
  targetStatus: z.enum([RECEIVABLE_STATUS.PROCESSING, RECEIVABLE_STATUS.COMPLETED]),
});

/**
 * Settlement advances (`processing`, `completed`) — **Dupply API key only** (workers / BFF).
 * Replace with an internal job queue when moving off synchronous triggers.
 */
export async function registerReceivableInternalRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  app.post(
    "/v1/internal/receivables/:id/advance-settlement",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const id = (request.params as { id: string }).id;
      const parsed = advanceBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }
      try {
        await executeSystemAdvanceSettlement(deps, {
          receivableId: id,
          targetStatus: parsed.data.targetStatus,
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
        throw e;
      }
    },
  );
}
