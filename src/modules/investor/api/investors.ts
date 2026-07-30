import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../../compose/deps.js";
import { executeDeposit } from "../application/commands/executeDepositCommand.js";
import { executeGetInvestor } from "../application/queries/executeGetInvestorQuery.js";
import { executeListDeposits } from "../application/queries/executeListDepositsQuery.js";
import {
  INVESTOR_ERROR_CODES,
  InvestorError,
  type InvestorErrorCode,
} from "../domain/errors.js";
import { requireRoles } from "../../../plugins/require-roles.js";

const depositBodySchema = z.object({
  amount: z.number().positive(),
  idempotencyKey: z.string().min(1),
  externalTxId: z.string().optional(),
});

const INVESTOR_ERROR_HTTP: Partial<Record<InvestorErrorCode, number>> = {
  [INVESTOR_ERROR_CODES.NOT_FOUND]: 404,
  [INVESTOR_ERROR_CODES.IDEMPOTENCY_CONFLICT]: 409,
  [INVESTOR_ERROR_CODES.INVALID_AMOUNT]: 400,
};

function mapInvestorError(e: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }): unknown {
  if (e instanceof InvestorError) {
    const status = INVESTOR_ERROR_HTTP[e.code] ?? 400;
    return reply.code(status).send({ error: e.code });
  }
  return undefined;
}

export async function registerInvestorRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/investors/deposit",
    {
      preHandler: requireRoles("investor"),
      schema: {
        tags: ["Investors"],
        summary: "Realizar depósito na conta de investidor",
        body: depositBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        const result = await executeDeposit(deps, {
          accountId: request.auth.sub,
          amountReais: request.body.amount,
          idempotencyKey: request.body.idempotencyKey,
          externalTxId: request.body.externalTxId,
        });
        return reply.code(201).send(result);
      } catch (e) {
        const mapped = mapInvestorError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.get(
    "/v1/investors/deposits",
    {
      preHandler: requireRoles("investor"),
      schema: {
        tags: ["Investors"],
        summary: "Listar depósitos do investidor",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        return await executeListDeposits(deps, request.auth.sub);
      } catch (e) {
        const mapped = mapInvestorError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );

  api.get(
    "/v1/investors/me",
    {
      preHandler: requireRoles("investor"),
      schema: {
        tags: ["Investors"],
        summary: "Obter perfil do investidor",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
      try {
        return await executeGetInvestor(deps, request.auth.sub);
      } catch (e) {
        const mapped = mapInvestorError(e, reply);
        if (mapped) return mapped;
        throw e;
      }
    },
  );
}
