import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { rampOrders } from "../../../../infra/database/schema.runtime.js";
import { extractOnRampDepositInstructions, safeJsonParse } from "../rampHelpers.js";

export class RampOrderNotFoundError extends Error {
  constructor() {
    super("ramp_order_not_found");
    this.name = "RampOrderNotFoundError";
  }
}

export type GetRampOrderByIdResult = {
  id: string;
  rampQuoteId: string;
  externalOrderId: string;
  status: string;
  request: unknown;
  order: unknown;
  onRampDeposit: unknown;
  createdAtMs: string;
  updatedAtMs: string;
};

export async function executeGetRampOrderById(
  deps: AppDeps,
  orderId: string,
): Promise<GetRampOrderByIdResult> {
  const [row] = await deps.db
    .select()
    .from(rampOrders)
    .where(eq(rampOrders.id, orderId))
    .limit(1);
  if (!row) throw new RampOrderNotFoundError();

  return {
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
  };
}
