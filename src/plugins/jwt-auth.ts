import type { FastifyReply, FastifyRequest } from "fastify";

import type { AppConfig } from "../config.js";
import { verifyAccessToken } from "../lib/jwt.js";

export function requireJwt(config: AppConfig) {
  return async function requireJwtHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!config.JWT_SECRET) {
      return reply.code(503).send({ error: "JWT_SECRET not configured" });
    }
    const raw = request.headers.authorization;
    const header = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
    if (!header.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    try {
      const payload = await verifyAccessToken(config, token);
      request.auth = {
        sub: payload.sub,
        role: payload.role,
        principalKind: payload.principalKind,
      };
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
  };
}
