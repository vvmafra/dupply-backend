import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";

import type { AppConfig } from "../../config.js";
import type { Db } from "../../db/index.js";
import { rampOrders } from "../../db/schema.runtime.js";
import { verifyEtherfuseWebhookSignature } from "../../integrations/etherfuse/webhook-verify.js";

function readOrderId(body: Record<string, unknown>): string | undefined {
  const data = body.data;
  if (data && typeof data === "object" && data !== null) {
    const id = (data as { orderId?: unknown }).orderId;
    if (typeof id === "string") return id;
  }
  const top = body.orderId;
  if (typeof top === "string") return top;
  return undefined;
}

function readStatus(payload: unknown): string | undefined {
  if (payload && typeof payload === "object" && payload !== null) {
    const s = (payload as { status?: unknown }).status;
    if (typeof s === "string") return s;
  }
  return undefined;
}

export async function registerEtherfuseWebhook(
  app: FastifyInstance,
  deps: { db: Db; config: AppConfig },
): Promise<void> {
  const { db, config } = deps;

  app.post(
    "/v1/webhooks/etherfuse",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const secret = config.ETHERFUSE_WEBHOOK_SECRET;
      if (!secret) {
        return reply.code(503).send({ error: "ETHERFUSE_WEBHOOK_SECRET not configured" });
      }
      const sig = request.headers["x-signature"];
      const sigStr = typeof sig === "string" ? sig : Array.isArray(sig) ? sig[0] : undefined;
      const body = request.body;
      if (!body || typeof body !== "object") {
        return reply.code(400).send({ error: "expected_json_object" });
      }
      const bodyObj = body as Record<string, unknown>;
      const ok = verifyEtherfuseWebhookSignature(bodyObj, secret, sigStr);
      if (!ok) {
        return reply.code(401).send({ error: "invalid_signature" });
      }

      const orderId = readOrderId(bodyObj);
      const payload = bodyObj.data ?? bodyObj;
      const status = readStatus(payload);

      if (orderId) {
        const [row] = await db
          .select()
          .from(rampOrders)
          .where(eq(rampOrders.externalOrderId, orderId))
          .limit(1);
        if (row) {
          let prev: Record<string, unknown> = {};
          if (row.responseJson) {
            try {
              prev = JSON.parse(row.responseJson) as Record<string, unknown>;
            } catch {
              prev = {};
            }
          }
          const merged = { ...prev, lastWebhook: payload };
          await db
            .update(rampOrders)
            .set({
              status: status ?? row.status,
              responseJson: JSON.stringify(merged),
              updatedAtMs: String(Date.now()),
            })
            .where(eq(rampOrders.id, row.id));
        }
      }

      return reply.code(204).send();
    },
  );
}
