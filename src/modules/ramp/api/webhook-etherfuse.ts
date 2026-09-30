import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import type { AppDeps } from "../../../compose/deps.js";
import {
  executeApplyRampWebhook,
  ExpectedJsonObjectError,
  InvalidWebhookSignatureError,
  WebhookSecretNotConfiguredError,
} from "../application/commands/applyRampWebhook.js";

export async function registerEtherfuseWebhook(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/webhooks/etherfuse",
    {
      schema: {
        hide: true,
      },
    },
    async (request, reply) => {
      const sig = request.headers["x-signature"];
      const sigStr = typeof sig === "string" ? sig : Array.isArray(sig) ? sig[0] : undefined;
      try {
        await executeApplyRampWebhook(deps, {
          body: request.body,
          signature: sigStr,
        });
        return reply.code(204).send();
      } catch (e) {
        if (e instanceof WebhookSecretNotConfiguredError) {
          return reply.code(503).send({ error: "ETHERFUSE_WEBHOOK_SECRET not configured" });
        }
        if (e instanceof ExpectedJsonObjectError) {
          return reply.code(400).send({ error: "expected_json_object" });
        }
        if (e instanceof InvalidWebhookSignatureError) {
          return reply.code(401).send({ error: "invalid_signature" });
        }
        throw e;
      }
    },
  );
}
