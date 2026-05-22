import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import argon2 from "argon2";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { platformUsers } from "../../db/schema.runtime.js";
import { signAccessToken } from "../../lib/jwt.js";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const serviceLoginBodySchema = z.object({
  email: z.string().email(),
  apiKey: z.string().min(1),
});

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const { db, config } = deps;

  app.post(
    "/v1/auth/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!config.JWT_SECRET) {
        return reply.code(503).send({ error: "JWT_SECRET not configured" });
      }
      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }
      const [user] = await db
        .select()
        .from(platformUsers)
        .where(eq(platformUsers.email, parsed.data.email))
        .limit(1);
      if (!user || user.principalKind !== "human" || !user.passwordHash) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      const ok = await argon2.verify(user.passwordHash, parsed.data.password);
      if (!ok) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      if (user.status !== "active") {
        return reply.code(403).send({ error: "account_inactive" });
      }
      const token = await signAccessToken(config, {
        sub: user.id,
        role: user.role,
        principalKind: user.principalKind,
      });
      return { accessToken: token, tokenType: "Bearer", expiresInSeconds: config.JWT_ACCESS_TTL_SECONDS };
    },
  );

  app.post(
    "/v1/auth/service-login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!config.JWT_SECRET) {
        return reply.code(503).send({ error: "JWT_SECRET not configured" });
      }
      const parsed = serviceLoginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }
      const [user] = await db
        .select()
        .from(platformUsers)
        .where(eq(platformUsers.email, parsed.data.email))
        .limit(1);
      if (!user || user.principalKind !== "service" || !user.serviceApiKeyHash) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      const ok = await argon2.verify(user.serviceApiKeyHash, parsed.data.apiKey);
      if (!ok) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      if (user.status !== "active") {
        return reply.code(403).send({ error: "account_inactive" });
      }
      const token = await signAccessToken(config, {
        sub: user.id,
        role: user.role,
        principalKind: user.principalKind,
      });
      return { accessToken: token, tokenType: "Bearer", expiresInSeconds: config.JWT_ACCESS_TTL_SECONDS };
    },
  );
}
