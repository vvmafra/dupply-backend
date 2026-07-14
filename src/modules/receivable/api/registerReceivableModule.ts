import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerReceivableRoutes } from "./receivables.js";

export async function registerReceivableModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerReceivableRoutes(app, deps);
}
