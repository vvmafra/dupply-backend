import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerAuthRoutes } from "./auth.js";

export async function registerAuthModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerAuthRoutes(app, deps);
}
