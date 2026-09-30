import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerAccountRoutes } from "./accounts.js";

export async function registerAccountModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerAccountRoutes(app, deps);
}
