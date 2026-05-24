import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeSystemAdvanceSettlement } from "../../application/receivable/commands/receivableCommands.js";
import { RECEIVABLE_STATUS, ReceivableTransitionError } from "../../domain/receivable/transitions.js";

const advanceBodySchema = z.object({
  targetStatus: z.enum([RECEIVABLE_STATUS.PROCESSING, RECEIVABLE_STATUS.COMPLETED]),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Settlement advances (`processing`, `completed`) — **Dupply API key only** (workers / BFF).
 * Replace with an internal job queue when moving off synchronous triggers.
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
        summary: "Avançar settlement de recebível (worker)",
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
        const msg = e instanceof Error ? e.message : "error";
        if (msg === "receivable_not_found") return reply.code(404).send({ error: msg });
        throw e;
      }
    },
  );
}
