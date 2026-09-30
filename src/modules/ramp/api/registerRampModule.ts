import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerRampRoutes } from "./ramp.js";

export async function registerRampModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerRampRoutes(app, deps);
}
