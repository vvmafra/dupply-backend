import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../../compose/deps.js";
import { executeAdminAdvanceStage } from "../application/commands/adminAdvanceStageCommand.js";
import { executeAdminOpenFunding } from "../application/commands/adminOpenFundingCommand.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../domain/errors.js";
import { ReceivableTransitionError } from "../domain/transitions.js";
import { requireRoles } from "../../../plugins/require-roles.js";
import { toReais } from "../../../shared/money.js";

const idParamsSchema = z.object({ id: z.string().min(1) });

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
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const result = await executeAdminOpenFunding(deps, {
          receivableId: request.params.id,
        });
        return {
          from: result.from,
          to: result.to,
          targetFunding: toReais(result.targetFundingCents),
        };
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
