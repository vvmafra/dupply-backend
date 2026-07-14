import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerEtherfuseWebhook } from "./webhook-etherfuse.js";

/** Top-level webhook registration — unchanged path `/v1/webhooks/etherfuse`. */
export async function registerRampWebhookModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerEtherfuseWebhook(app, deps);
}
