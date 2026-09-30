import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { rampOrders } from "../../../../infra/database/schema.runtime.js";

export class WebhookSecretNotConfiguredError extends Error {
  constructor() {
    super("ETHERFUSE_WEBHOOK_SECRET not configured");
    this.name = "WebhookSecretNotConfiguredError";
  }
}

export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super("invalid_signature");
    this.name = "InvalidWebhookSignatureError";
  }
}

export class ExpectedJsonObjectError extends Error {
  constructor() {
    super("expected_json_object");
    this.name = "ExpectedJsonObjectError";
  }
}

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

export type ApplyRampWebhookInput = {
  body: unknown;
  signature: string | undefined;
};

/** Applies Etherfuse webhook: verify signature and update matching ramp_orders row. */
export async function executeApplyRampWebhook(
  deps: AppDeps,
  input: ApplyRampWebhookInput,
): Promise<void> {
  if (!deps.config.ETHERFUSE_WEBHOOK_SECRET) {
    throw new WebhookSecretNotConfiguredError();
  }
  if (!input.body || typeof input.body !== "object") {
    throw new ExpectedJsonObjectError();
  }
  const bodyObj = input.body as Record<string, unknown>;
  const ok = deps.gateways.ramp.verifyWebhookSignature(bodyObj, input.signature);
  if (!ok) {
    throw new InvalidWebhookSignatureError();
  }

  const orderId = readOrderId(bodyObj);
  const payload = bodyObj.data ?? bodyObj;
  const status = readStatus(payload);

  if (!orderId) return;

  const [row] = await deps.db
    .select()
    .from(rampOrders)
    .where(eq(rampOrders.externalOrderId, orderId))
    .limit(1);
  if (!row) return;

  let prev: Record<string, unknown> = {};
  if (row.responseJson) {
    try {
      prev = JSON.parse(row.responseJson) as Record<string, unknown>;
    } catch {
      prev = {};
    }
  }
  const merged = { ...prev, lastWebhook: payload };
  await deps.db
    .update(rampOrders)
    .set({
      status: status ?? row.status,
      responseJson: JSON.stringify(merged),
      updatedAtMs: String(Date.now()),
    })
    .where(eq(rampOrders.id, row.id));
}
