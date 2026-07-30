import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerInvestorRoutes } from "./investors.js";

export async function registerInvestorModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerInvestorRoutes(app, deps);
}
