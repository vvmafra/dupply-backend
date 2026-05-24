import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeHumanLogin } from "../../application/account/commands/loginCommands.js";
import { executeLogout } from "../../application/account/commands/logoutCommands.js";
import { executeRefreshToken } from "../../application/account/commands/refreshCommands.js";
import {
  AUTH_ERROR_CODES,
  AuthError,
  type AuthErrorCode,
} from "../../domain/account/errors.js";
import { requireJwt } from "../../plugins/jwt-auth.js";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

const AUTH_ERROR_HTTP: Partial<Record<AuthErrorCode, number>> = {
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: 401,
  [AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN]: 401,
  [AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED]: 401,
  [AUTH_ERROR_CODES.ACCOUNT_INACTIVE]: 403,
  [AUTH_ERROR_CODES.ACCOUNT_DELETED]: 403,
};

function mapAuthError(e: unknown, reply: FastifyReply): FastifyReply | undefined {
  if (e instanceof AuthError) {
    const status = AUTH_ERROR_HTTP[e.code] ?? 401;
    return reply.code(status).send({ error: e.code });
  }
  return undefined;
}

function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): request is FastifyRequest & { auth: NonNullable<FastifyRequest["auth"]> } {
  if (!request.auth) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const { config } = deps;

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
      try {
        return await executeHumanLogin(deps, parsed.data);
      } catch (e) {
        const mapped = mapAuthError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  app.post(
    "/v1/auth/refresh",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!config.JWT_SECRET) {
        return reply.code(503).send({ error: "JWT_SECRET not configured" });
      }
      const parsed = refreshBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }
      try {
        return await executeRefreshToken(deps, parsed.data);
      } catch (e) {
        const mapped = mapAuthError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  app.post(
    "/v1/auth/logout",
    { preHandler: requireJwt(config) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(request, reply)) return;
      try {
        await executeLogout(deps, request.auth.sub);
        return reply.code(204).send();
      } catch (e) {
        const mapped = mapAuthError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );
}
