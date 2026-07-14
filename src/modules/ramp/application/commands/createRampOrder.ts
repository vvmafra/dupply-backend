import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { rampOrders, rampQuotes } from "../../../../infra/database/schema.runtime.js";
import { extractOnRampDepositInstructions, nowMs } from "../rampHelpers.js";

export class RampQuoteNotFoundError extends Error {
  constructor() {
    super("ramp_quote_not_found");
    this.name = "RampQuoteNotFoundError";
  }
}

export type CreateRampOrderInput = {
  rampQuoteId: string;
  orderId?: string;
  bankAccountId: string;
  publicKey?: string;
  cryptoWalletId?: string;
  memo?: string;
  useAnchor?: boolean;
  userId?: string;
};

export type CreateRampOrderResult = {
  id: string;
  externalOrderId: string;
  order: unknown;
  onRampDeposit: unknown;
};

export async function executeCreateRampOrder(
  deps: AppDeps,
  input: CreateRampOrderInput,
): Promise<CreateRampOrderResult> {
  const [quoteRow] = await deps.db
    .select()
    .from(rampQuotes)
    .where(eq(rampQuotes.id, input.rampQuoteId))
    .limit(1);
  if (!quoteRow) throw new RampQuoteNotFoundError();

  const orderUuid = input.orderId ?? randomUUID();
  const efOrder = {
    orderId: orderUuid,
    bankAccountId: input.bankAccountId,
    quoteId: quoteRow.externalQuoteId,
    publicKey: input.publicKey ?? null,
    cryptoWalletId: input.cryptoWalletId ?? null,
    memo: input.memo ?? null,
    useAnchor: input.useAnchor ?? false,
  };

  const responseJson = await deps.gateways.ramp.createOrder(efOrder);

  const internalOrderId = randomUUID();
  await deps.db.insert(rampOrders).values({
    id: internalOrderId,
    userId: input.userId ?? null,
    rampQuoteId: quoteRow.id,
    externalOrderId: orderUuid,
    status: "created",
    requestJson: JSON.stringify(efOrder),
    responseJson: JSON.stringify(responseJson),
    createdAtMs: nowMs(),
    updatedAtMs: nowMs(),
  });

  return {
    id: internalOrderId,
    externalOrderId: orderUuid,
    order: responseJson,
    onRampDeposit: extractOnRampDepositInstructions(responseJson),
  };
}
