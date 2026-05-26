import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeHumanLogin, buildLoginResult } from "../../application/account/commands/loginCommands.js";
import { findAccountByEmail, persistRefreshToken } from "../../application/account/commands/accountAuthDb.js";
import { executeLogout } from "../../application/account/commands/logoutCommands.js";
import { executeRefreshToken } from "../../application/account/commands/refreshCommands.js";
import { executeRegisterSeller } from "../../application/seller/commands/registerSellerCommand.js";
import {
  AUTH_ERROR_CODES,
  AuthError,
  type AuthErrorCode,
} from "../../domain/account/errors.js";
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
} from "../../lib/authCookie.js";
import { issueRefreshToken } from "../../lib/refreshToken.js";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().min(1),
  role: z.literal("seller"),
});

function isUniqueConstraintError(e: unknown): boolean {
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    return msg.includes("unique") || msg.includes("constraint");
  }
  return false;
}

const AUTH_ERROR_HTTP: Partial<Record<AuthErrorCode, number>> = {
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: 401,
  [AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN]: 401,
  [AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED]: 401,
  [AUTH_ERROR_CODES.ACCOUNT_INACTIVE]: 403,
  [AUTH_ERROR_CODES.ACCOUNT_DELETED]: 403,
};

function mapAuthError(e: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }): unknown {
  if (e instanceof AuthError) {
    const status = AUTH_ERROR_HTTP[e.code] ?? 401;
    return reply.code(status).send({ error: e.code });
  }
  return undefined;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const { config } = deps;
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/auth/register",
    {
      schema: {
        tags: ["Auth"],
        summary: "Registrar novo seller",
        body: registerBodySchema,
        security: [],
      },
    },
    async (request, reply) => {
      if (!config.JWT_SECRET) {
        return reply.code(503).send({ error: "JWT_SECRET not configured" });
      }
      try {
        const { accountId, sellerId } = await executeRegisterSeller(deps, {
          email: request.body.email,
          password: request.body.password,
          name: request.body.name,
        });
        const account = await findAccountByEmail(deps, request.body.email);
        if (!account) {
          throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
        }
        const { plain, stored } = await issueRefreshToken();
        await persistRefreshToken(deps, accountId, plain, stored);
        const loginResult = await buildLoginResult(deps, account, plain);
        setRefreshCookie(reply, config, loginResult.refreshToken);
        return reply.code(201).send({ ...loginResult.body, sellerId });
      } catch (e) {
        if (isUniqueConstraintError(e)) {
          return reply.code(409).send({ error: "email_already_exists" });
        }
        const mapped = mapAuthError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.post(
    "/v1/auth/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Login com email e senha",
        body: loginBodySchema,
        security: [],
      },
    },
    async (request, reply) => {
      if (!config.JWT_SECRET) {
        return reply.code(503).send({ error: "JWT_SECRET not configured" });
      }
      try {
        const result = await executeHumanLogin(deps, request.body);
        setRefreshCookie(reply, config, result.refreshToken);
        return reply.send(result.body);
      } catch (e) {
        const mapped = mapAuthError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.post(
    "/v1/auth/refresh",
    {
      schema: {
        tags: ["Auth"],
        summary: "Renovar access token",
        security: [],
      },
    },
    async (request, reply) => {
      if (!config.JWT_SECRET) {
        return reply.code(503).send({ error: "JWT_SECRET not configured" });
      }
      const plain = request.cookies[REFRESH_COOKIE_NAME];
      if (!plain) {
        return reply.code(401).send({ error: "missing_refresh_token" });
      }
      try {
        const result = await executeRefreshToken(deps, { refreshToken: plain });
        setRefreshCookie(reply, config, result.refreshToken);
        return reply.send(result.body);
      } catch (e) {
        clearRefreshCookie(reply);
        const mapped = mapAuthError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.post(
    "/v1/auth/logout",
    {
      schema: {
        tags: ["Auth"],
        summary: "Logout (invalida refresh token)",
        security: [],
      },
    },
    async (request, reply) => {
      const plain = request.cookies[REFRESH_COOKIE_NAME];
      if (plain) {
        await executeLogout(deps, plain);
      }
      clearRefreshCookie(reply);
      return reply.code(204).send();
    },
  );
}
