import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executePayerMagicLinkRespond } from "../../application/receivable/commands/payerMagicLinkRespondCommand.js";
import { PAYER_ERROR_CODES, PayerError } from "../../domain/payer/errors.js";
import { ReceivableTransitionError } from "../../domain/receivable/transitions.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../domain/receivable/errors.js";

const magicLinkRespondBodySchema = z.object({
  token: z.string().min(1),
  decision: z.enum(["accept", "reject"]),
});

export async function registerPayerRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/payers/magic-link/respond",
    {
      schema: {
        tags: ["Payers"],
        summary: "Payer accepts or rejects receivable via magic link token",
        security: [],
        body: magicLinkRespondBodySchema,
      },
    },
    async (request, reply) => {
      try {
        await executePayerMagicLinkRespond(deps, {
          token: request.body.token,
          decision: request.body.decision,
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof PayerError) {
          const status = e.code === PAYER_ERROR_CODES.INVALID_TOKEN ? 400 : 400;
          return reply.code(status).send({ error: e.code });
        }
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
}
