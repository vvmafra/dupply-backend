import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerPayerRoutes } from "./payers.js";

export async function registerPayerModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerPayerRoutes(app, deps);
}
