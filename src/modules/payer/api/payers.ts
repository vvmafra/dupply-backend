import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../../compose/deps.js";

const magicLinkRespondBodySchema = z.object({
  token: z.string().min(1),
  decision: z.enum(["accept", "reject"]),
});

export async function registerPayerRoutes(app: FastifyInstance, _deps: AppDeps): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/payers/magic-link/respond",
    {
      schema: {
        tags: ["Payers"],
        summary:
          "[Deprecated] Payer confirmation via magic link — removed; receivables proceed on seller accept",
        deprecated: true,
        security: [],
        body: magicLinkRespondBodySchema,
      },
    },
    async (_request, reply) => {
      return reply.code(410).send({
        error: "payer_confirmation_removed",
        message:
          "Payer confirmation no longer gates receivable settlement. Seller acceptance moves the receivable to confirmed.",
      });
    },
  );
}
