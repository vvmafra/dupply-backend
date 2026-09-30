import type { FastifyInstance } from "fastify";

import type { AppDeps } from "../../../compose/deps.js";
import { registerSellerRoutes } from "./sellers.js";

export async function registerSellerModule(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerSellerRoutes(app, deps);
}
