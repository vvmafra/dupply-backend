import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
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

function mapAccountError(e: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }): unknown {
  if (e instanceof AccountError) {
    const status = ACCOUNT_ERROR_HTTP[e.code] ?? 400;
    return reply.code(status).send({ error: e.code });
  }
  return undefined;
}

export async function registerAccountRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    "/v1/accounts/:id",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Buscar conta por ID",
        params: accountIdParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        const actor = {
          sub: request.auth.sub,
          role: request.auth.role as AccountRole,
        };
        return await executeGetAccount(deps, actor, request.params.id);
      } catch (e) {
        const mapped = mapAccountError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.patch(
    "/v1/accounts/:id",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Atualizar senha",
        params: accountIdParamsSchema,
        body: updatePasswordBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        const actor = {
          sub: request.auth.sub,
          role: request.auth.role as AccountRole,
        };
        await executeUpdatePassword(deps, actor, request.params.id, request.body);
        return reply.code(204).send();
      } catch (e) {
        const mapped = mapAccountError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.delete(
    "/v1/accounts/:id",
    {
      schema: {
        tags: ["Accounts"],
        summary: "Soft-delete de conta",
        params: accountIdParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        await executeSoftDeleteAccount(
          deps,
          { role: request.auth.role as AccountRole },
          request.params.id,
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
