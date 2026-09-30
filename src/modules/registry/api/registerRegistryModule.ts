import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerTradeBillRoutes } from "./trade-bills.js";

export async function registerRegistryModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerTradeBillRoutes(app, deps);
}
