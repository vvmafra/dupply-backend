import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AppConfig } from "../../config.js";
import type { Db } from "../../db/index.js";
import { rampOrders, rampQuotes } from "../../db/schema.js";
import {
  EtherfuseClient,
  EtherfuseHttpError,
  type EtherfuseQuoteRequest,
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
  userId: z.string().optional(),
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

function nowMs(): string {
  return String(Date.now());
}

export async function registerRampRoutes(
  app: FastifyInstance,
  deps: { db: Db; config: AppConfig },
): Promise<void> {
  const { db, config } = deps;

  app.post("/v1/ramp/quotes", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config.ETHERFUSE_API_KEY) {
      return reply.code(503).send({ error: "ETHERFUSE_API_KEY not configured" });
    }
    const parsed = postQuoteBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const internalId = randomUUID();
    const quoteId = randomUUID();

    const efBody: EtherfuseQuoteRequest = {
      quoteId,
      customerId: body.customerId,
      blockchain: body.blockchain,
      quoteAssets: body.quoteAssets,
      sourceAmount: body.sourceAmount,
      walletAddress: body.walletAddress ?? undefined,
    };

    const client = new EtherfuseClient(config.ETHERFUSE_BASE_URL, config.ETHERFUSE_API_KEY);
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
  });

  app.post("/v1/ramp/orders", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!config.ETHERFUSE_API_KEY) {
      return reply.code(503).send({ error: "ETHERFUSE_API_KEY not configured" });
    }
    const parsed = postOrderBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const body = parsed.data;

    const [quoteRow] = await db
      .select()
      .from(rampQuotes)
      .where(eq(rampQuotes.id, body.rampQuoteId))
      .limit(1);
    if (!quoteRow) {
      return reply.code(404).send({ error: "ramp_quote_not_found" });
    }

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
    });
  });

  app.get("/v1/ramp/orders/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(id).success) {
      return reply.code(400).send({ error: "invalid_id" });
    }
    const [row] = await db.select().from(rampOrders).where(eq(rampOrders.id, id)).limit(1);
    if (!row) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.send({
      id: row.id,
      rampQuoteId: row.rampQuoteId,
      externalOrderId: row.externalOrderId,
      status: row.status,
      request: safeJsonParse(row.requestJson),
      order: row.responseJson ? safeJsonParse(row.responseJson) : null,
      createdAtMs: row.createdAtMs,
      updatedAtMs: row.updatedAtMs,
    });
  });
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
