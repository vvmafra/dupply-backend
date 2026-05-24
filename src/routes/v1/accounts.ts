import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeSoftDeleteAccount } from "../../application/account/commands/softDeleteAccountCommand.js";
import { executeUpdatePassword } from "../../application/account/commands/updatePasswordCommand.js";
import { executeGetAccount } from "../../application/account/queries/getAccountQuery.js";
import {
  ACCOUNT_ERROR_CODES,
  AccountError,
  type AccountErrorCode,
} from "../../domain/account/errors.js";
import type { AccountRole } from "../../domain/account/types.js";

const accountIdParamsSchema = z.object({
  id: z.string().min(1),
});

const updatePasswordBodySchema = z.object({
  password: z.string().min(1),
});

const ACCOUNT_ERROR_HTTP: Partial<Record<AccountErrorCode, number>> = {
  [ACCOUNT_ERROR_CODES.FORBIDDEN]: 403,
  [ACCOUNT_ERROR_CODES.NOT_FOUND]: 404,
};

function mapAccountError(e: unknown, reply: FastifyReply): FastifyReply | undefined {
  if (e instanceof AccountError) {
    const status = ACCOUNT_ERROR_HTTP[e.code] ?? 400;
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

export async function registerAccountRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  app.get(
    "/v1/accounts/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(request, reply)) return;
      const parsed = accountIdParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }
      try {
        const actor = {
          sub: request.auth.sub,
          role: request.auth.role as AccountRole,
        };
        return await executeGetAccount(deps, actor, parsed.data.id);
      } catch (e) {
        const mapped = mapAccountError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  app.patch(
    "/v1/accounts/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(request, reply)) return;
      const parsedParams = accountIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply
          .code(400)
          .send({ error: "validation_error", details: parsedParams.error.flatten() });
      }
      const parsedBody = updatePasswordBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({ error: "validation_error", details: parsedBody.error.flatten() });
      }
      try {
        const actor = {
          sub: request.auth.sub,
          role: request.auth.role as AccountRole,
        };
        await executeUpdatePassword(deps, actor, parsedParams.data.id, parsedBody.data);
        return reply.code(204).send();
      } catch (e) {
        const mapped = mapAccountError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  app.delete(
    "/v1/accounts/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!requireAuth(request, reply)) return;
      const parsed = accountIdParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation_error", details: parsed.error.flatten() });
      }
      try {
        await executeSoftDeleteAccount(
          deps,
          { role: request.auth.role as AccountRole },
          parsed.data.id,
        );
        return reply.code(204).send();
      } catch (e) {
        const mapped = mapAccountError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );
}
