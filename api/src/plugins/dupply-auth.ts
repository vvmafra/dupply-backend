import type { FastifyReply, FastifyRequest } from "fastify";

import type { AppConfig } from "../config.js";

export function requireDupplyApiKey(config: AppConfig) {
  return async function requireDupplyApiKeyHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!config.DUPPLY_API_KEY) {
      return reply.code(503).send({ error: "DUPPLY_API_KEY not configured" });
    }
    const header = request.headers["x-dupply-api-key"];
    const key = typeof header === "string" ? header : Array.isArray(header) ? header[0] : "";
    if (key !== config.DUPPLY_API_KEY) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  };
}
