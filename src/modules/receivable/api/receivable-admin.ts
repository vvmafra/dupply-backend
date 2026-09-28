import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../../compose/deps.js";
import { executeAdminAdvanceStage } from "../application/commands/adminAdvanceStageCommand.js";
import { executeAdminOpenFunding } from "../application/commands/adminOpenFundingCommand.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../domain/errors.js";
import { MAX_YIELD_RATE_MONTHLY } from "../domain/offerTerms.js";
import { ReceivableTransitionError } from "../domain/transitions.js";
import { requireRoles } from "../../../plugins/require-roles.js";
import { toReais } from "../../../shared/money.js";

const idParamsSchema = z.object({ id: z.string().min(1) });

/**
 * Optional overrides of the analyst's offer terms. Body may be omitted entirely (Fastify then
 * hands us `null`; send no `content-type`) or be `{}`; rate as a fraction (0.018 = 1.8% a.m.), ticket in reais.
 */
const openFundingBodySchema = z
  .object({
    yieldRateMonthly: z.number().min(0).max(MAX_YIELD_RATE_MONTHLY).optional(),
    minInvestment: z.number().positive().multipleOf(0.01).optional(),
  })
  .nullish();

/**
 * Admin lifecycle triggers — JWT `admin` role. The transitions stay system-only in the domain;
 * these routes are the manual trigger used by the admin UI.
 */
export async function registerReceivableAdminRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/admin/receivables/:id/open-funding",
    {
      preHandler: requireRoles("admin"),
      schema: {
        tags: ["Admin"],
        summary: "Open funding for a confirmed receivable (admin)",
        params: idParamsSchema,
        body: openFundingBodySchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const result = await executeAdminOpenFunding(deps, {
          receivableId: request.params.id,
          yieldRateMonthly: request.body?.yieldRateMonthly,
          minInvestment: request.body?.minInvestment,
        });
        return {
          from: result.from,
          to: result.to,
          targetFunding: toReais(result.targetFundingCents),
          yieldRateMonthly: result.yieldRateMonthly,
          minInvestment: toReais(result.minInvestmentCents),
        };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) {
          return reply.code(409).send({ error: e.message });
        }
        if (e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.NOT_FOUND) {
          return reply.code(404).send({ error: e.code });
        }
        if (e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.INVALID_OFFER_TERMS) {
          return reply.code(400).send({ error: e.code });
        }
        throw e;
      }
    },
  );

  api.post(
    "/v1/admin/receivables/:id/advance-stage",
    {
      preHandler: requireRoles("admin"),
      schema: {
        tags: ["Admin"],
        summary:
          "Advance receivable to the next stage (admin): funded → processing → completed → payer_settled",
        params: idParamsSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const result = await executeAdminAdvanceStage(deps, {
          receivableId: request.params.id,
        });
        return { from: result.from, to: result.to };
      } catch (e) {
        if (e instanceof ReceivableTransitionError) {
          return reply.code(409).send({ error: e.message });
        }
        if (e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.NOT_FOUND) {
          return reply.code(404).send({ error: e.code });
        }
        throw e;
      }
    },
  );
}
