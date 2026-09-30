import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerWalletRoutes } from "./wallets.js";

export async function registerWalletModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerWalletRoutes(app, deps);
}
