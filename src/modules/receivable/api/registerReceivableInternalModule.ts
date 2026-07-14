import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerReceivableInternalRoutes } from "./receivable-internal.js";

export async function registerReceivableInternalModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerReceivableInternalRoutes(app, deps);
}
