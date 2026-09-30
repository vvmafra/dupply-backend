import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppDeps } from "../../../compose/deps.js";
import { executeCreateRampOrder, RampQuoteNotFoundError } from "../application/commands/createRampOrder.js";
import {
  executeCreateRampQuote,
  WalletAddressRequiredError,
} from "../application/commands/createRampQuote.js";
import { executeGetRampAssets } from "../application/queries/getRampAssets.js";
import {
  executeGetRampOrderById,
  RampOrderNotFoundError,
} from "../application/queries/getRampOrderById.js";
import { EtherfuseHttpError } from "../application/rampErrors.js";
import { safeJsonParse } from "../application/rampHelpers.js";

const quoteAssetsSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("onramp"),
    sourceAsset: z.string().min(1),
    targetAsset: z.string().min(1),
  }),
  z.object({
    type: z.literal("offramp"),
    sourceAsset: z.string().min(1),
    targetAsset: z.string().min(1),
  }),
  z.object({
    type: z.literal("swap"),
    sourceAsset: z.string().min(1),
    targetAsset: z.string().min(1),
  }),
]);

const postQuoteBodySchema = z.object({
  customerId: z.string().uuid(),
  blockchain: z.enum(["stellar", "solana", "base", "polygon", "monad"]),
  quoteAssets: quoteAssetsSchema,
  sourceAmount: z.string().min(1),
  walletAddress: z.string().optional(),
  /** When true, resolves plain symbols (e.g. CETES, TESOURO) to CODE:ISSUER via GET /ramp/assets. */
  resolveAssetIdentifiers: z.boolean().optional(),
  userId: z.string().optional(),
});

const getAssetsQuerySchema = z.object({
  blockchain: z.enum(["stellar", "solana", "base", "polygon", "monad"]),
  currency: z.string().min(1),
  wallet: z.string().min(1),
});

const postOrderBodySchema = z.object({
  rampQuoteId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid(),
  publicKey: z.string().optional(),
  cryptoWalletId: z.string().uuid().optional(),
  memo: z.string().optional(),
  useAnchor: z.boolean().optional(),
  userId: z.string().optional(),
});

const orderIdParamsSchema = z.object({ id: z.string().uuid() });

function etherfuseErrorReply(
  e: EtherfuseHttpError,
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
): unknown {
  return reply.code(502).send({
    error: "etherfuse_error",
    status: e.status,
    message: e.message,
    body: safeJsonParse(e.bodyText),
  });
}

export async function registerRampRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const { config } = deps;
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    "/v1/ramp/assets",
    {
      schema: {
        tags: ["Ramp"],
        summary: "Listar ativos disponíveis para ramp",
        querystring: getAssetsQuerySchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      if (!config.ETHERFUSE_API_KEY) {
        return reply.code(503).send({ error: "ETHERFUSE_API_KEY not configured" });
      }
      const { blockchain, currency, wallet } = request.query;
      try {
        const data = await executeGetRampAssets(deps, { blockchain, currency, wallet });
        return reply.send(data);
      } catch (e) {
        if (e instanceof EtherfuseHttpError) return etherfuseErrorReply(e, reply);
        throw e;
      }
    },
  );

  api.post(
    "/v1/ramp/quotes",
    {
      schema: {
        tags: ["Ramp"],
        summary: "Criar cotação de ramp",
        body: postQuoteBodySchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      if (!config.ETHERFUSE_API_KEY) {
        return reply.code(503).send({ error: "ETHERFUSE_API_KEY not configured" });
      }
      try {
        const result = await executeCreateRampQuote(deps, request.body);
        return reply.send(result);
      } catch (e) {
        if (e instanceof WalletAddressRequiredError) {
          return reply.code(400).send({ error: e.message });
        }
        if (e instanceof EtherfuseHttpError) return etherfuseErrorReply(e, reply);
        throw e;
      }
    },
  );

  api.post(
    "/v1/ramp/orders",
    {
      schema: {
        tags: ["Ramp"],
        summary: "Criar ordem de ramp",
        body: postOrderBodySchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      if (!config.ETHERFUSE_API_KEY) {
        return reply.code(503).send({ error: "ETHERFUSE_API_KEY not configured" });
      }
      try {
        const result = await executeCreateRampOrder(deps, request.body);
        return reply.send(result);
      } catch (e) {
        if (e instanceof RampQuoteNotFoundError) {
          return reply.code(404).send({ error: "ramp_quote_not_found" });
        }
        if (e instanceof EtherfuseHttpError) return etherfuseErrorReply(e, reply);
        throw e;
      }
    },
  );

  api.get(
    "/v1/ramp/orders/:id",
    {
      schema: {
        tags: ["Ramp"],
        summary: "Buscar ordem de ramp por ID",
        params: orderIdParamsSchema,
        security: [{ dupplyApiKey: [] }],
      },
    },
    async (request, reply) => {
      try {
        const result = await executeGetRampOrderById(deps, request.params.id);
        return reply.send(result);
      } catch (e) {
        if (e instanceof RampOrderNotFoundError) {
          return reply.code(404).send({ error: "not_found" });
        }
        throw e;
      }
    },
  );
}
