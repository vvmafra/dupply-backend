import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AppDeps } from "../../application/deps.js";
import { executeGetRampAssets } from "../../application/ramp/queries/getRampAssets.js";
import { rampOrders, rampQuotes } from "../../db/schema.runtime.js";
import {
  EtherfuseClient,
  EtherfuseHttpError,
  type EtherfuseQuoteRequest,
  type QuoteAssets,
} from "../../integrations/etherfuse/client.js";

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

function nowMs(): string {
  return String(Date.now());
}

export async function registerRampRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const { db, config } = deps;
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
        const data = await executeGetRampAssets(deps, {
          blockchain,
          currency,
          wallet,
          etherfuseApiKey: config.ETHERFUSE_API_KEY,
        });
        return reply.send(data);
      } catch (e) {
        if (e instanceof EtherfuseHttpError) {
          return reply.code(502).send({
            error: "etherfuse_error",
            status: e.status,
            message: e.message,
            body: safeJsonParse(e.bodyText),
          });
        }
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
      const body = request.body;
      const internalId = randomUUID();
      const quoteId = randomUUID();

      const client = new EtherfuseClient(config.ETHERFUSE_BASE_URL, config.ETHERFUSE_API_KEY);

      let quoteAssets: QuoteAssets = body.quoteAssets;
      if (body.resolveAssetIdentifiers) {
        const w = body.walletAddress?.trim();
        if (!w) {
          return reply
            .code(400)
            .send({ error: "walletAddress required when resolveAssetIdentifiers is true" });
        }
        try {
          quoteAssets = await resolveEtherfuseQuoteAssets(client, body.blockchain, w, quoteAssets);
        } catch (e) {
          if (e instanceof EtherfuseHttpError) {
            return reply.code(502).send({
              error: "etherfuse_error",
              status: e.status,
              message: e.message,
              body: safeJsonParse(e.bodyText),
            });
          }
          throw e;
        }
      }

      const efBody: EtherfuseQuoteRequest = {
        quoteId,
        customerId: body.customerId,
        blockchain: body.blockchain,
        quoteAssets,
        sourceAmount: body.sourceAmount,
        walletAddress: body.walletAddress ?? undefined,
      };

      let responseJson: unknown;
      try {
        responseJson = await client.createQuote(efBody);
      } catch (e) {
        if (e instanceof EtherfuseHttpError) {
          return reply.code(502).send({
            error: "etherfuse_error",
            status: e.status,
            message: e.message,
            body: safeJsonParse(e.bodyText),
          });
        }
        throw e;
      }

      const resObj = responseJson as Record<string, unknown>;
      const expiresRaw = resObj.expiresAt ?? resObj.expires_at;
      const expiresAtMs =
        typeof expiresRaw === "string" || typeof expiresRaw === "number"
          ? String(new Date(expiresRaw).getTime())
          : null;

      await db.insert(rampQuotes).values({
        id: internalId,
        userId: body.userId ?? null,
        provider: "etherfuse",
        externalQuoteId: quoteId,
        requestJson: JSON.stringify(efBody),
        responseJson: JSON.stringify(responseJson),
        expiresAtMs,
        status: "active",
        createdAtMs: nowMs(),
      });

      return reply.send({
        id: internalId,
        etherfuseQuoteId: quoteId,
        quote: responseJson,
      });
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
      const body = request.body;

      const [quoteRow] = await db
        .select()
        .from(rampQuotes)
        .where(eq(rampQuotes.id, body.rampQuoteId))
        .limit(1);
      if (!quoteRow) return reply.code(404).send({ error: "ramp_quote_not_found" });

      const orderUuid = body.orderId ?? randomUUID();
      const efOrder = {
        orderId: orderUuid,
        bankAccountId: body.bankAccountId,
        quoteId: quoteRow.externalQuoteId,
        publicKey: body.publicKey ?? null,
        cryptoWalletId: body.cryptoWalletId ?? null,
        memo: body.memo ?? null,
        useAnchor: body.useAnchor ?? false,
      };

      const client = new EtherfuseClient(config.ETHERFUSE_BASE_URL, config.ETHERFUSE_API_KEY);
      let responseJson: unknown;
      try {
        responseJson = await client.createOrder(efOrder);
      } catch (e) {
        if (e instanceof EtherfuseHttpError) {
          return reply.code(502).send({
            error: "etherfuse_error",
            status: e.status,
            message: e.message,
            body: safeJsonParse(e.bodyText),
          });
        }
        throw e;
      }

      const internalOrderId = randomUUID();
      await db.insert(rampOrders).values({
        id: internalOrderId,
        userId: body.userId ?? null,
        rampQuoteId: quoteRow.id,
        externalOrderId: orderUuid,
        status: "created",
        requestJson: JSON.stringify(efOrder),
        responseJson: JSON.stringify(responseJson),
        createdAtMs: nowMs(),
        updatedAtMs: nowMs(),
      });

      return reply.send({
        id: internalOrderId,
        externalOrderId: orderUuid,
        order: responseJson,
        onRampDeposit: extractOnRampDepositInstructions(responseJson),
      });
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
      const [row] = await db
        .select()
        .from(rampOrders)
        .where(eq(rampOrders.id, request.params.id))
        .limit(1);
      if (!row) return reply.code(404).send({ error: "not_found" });
      return reply.send({
        id: row.id,
        rampQuoteId: row.rampQuoteId,
        externalOrderId: row.externalOrderId,
        status: row.status,
        request: safeJsonParse(row.requestJson),
        order: row.responseJson ? safeJsonParse(row.responseJson) : null,
        onRampDeposit: row.responseJson
          ? extractOnRampDepositInstructions(safeJsonParse(row.responseJson))
          : null,
        createdAtMs: row.createdAtMs,
        updatedAtMs: row.updatedAtMs,
      });
    },
  );
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Aligns with Regional Starter Pack: use fiat side (no colon) as GET /ramp/assets `currency` hint. */
async function resolveEtherfuseQuoteAssets(
  client: EtherfuseClient,
  blockchain: string,
  wallet: string,
  qa: QuoteAssets,
): Promise<QuoteAssets> {
  if (qa.type === "swap") return qa;
  const source = qa.sourceAsset;
  const target = qa.targetAsset;
  if (source.includes(":") && target.includes(":")) return qa;
  const fiat =
    qa.type === "onramp"
      ? !source.includes(":")
        ? source
        : !target.includes(":")
          ? target
          : "MXN"
      : !target.includes(":")
        ? target
        : !source.includes(":")
          ? source
          : "MXN";
  const { assets } = await client.getRampAssets(blockchain, fiat.toLowerCase(), wallet);
  const map = new Map(assets.map((a) => [a.symbol, a.identifier]));
  return {
    ...qa,
    sourceAsset: map.get(source) ?? source,
    targetAsset: map.get(target) ?? target,
  };
}

/** Normalized deposit instructions for on-ramp orders (SPEI Mexico vs PIX Brazil). */
function extractOnRampDepositInstructions(orderBody: unknown): unknown {
  if (!orderBody || typeof orderBody !== "object") return null;
  const root = orderBody as Record<string, unknown>;
  const on = root.onramp;
  if (!on || typeof on !== "object") return null;
  const r = on as Record<string, unknown>;
  const amount = typeof r.depositAmount === "string" ? r.depositAmount : "";
  if (typeof r.depositClabe === "string") {
    return {
      type: "spei" as const,
      clabe: r.depositClabe,
      bankName: r.bankName,
      beneficiary: r.beneficiary,
      amount,
    };
  }
  if (typeof r.depositPixCode === "string" || typeof r.depositPixKey === "string") {
    return {
      type: "pix" as const,
      pixCode:
        typeof r.depositPixCode === "string"
          ? r.depositPixCode
          : typeof r.depositPixKey === "string"
            ? r.depositPixKey
            : "",
      pixKey: typeof r.depositPixKey === "string" ? r.depositPixKey : undefined,
      pixKeyType: typeof r.depositPixKeyType === "string" ? r.depositPixKeyType : undefined,
      beneficiary: typeof r.beneficiary === "string" ? r.beneficiary : undefined,
      amount,
    };
  }
  return null;
}
