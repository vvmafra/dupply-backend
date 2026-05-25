import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { receivables } from "../../../db/schema.runtime.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../../domain/receivable/transitions.js";
import { loadReceivableOrThrow } from "../receivableHelpers.js";

export type SystemPayerSettlementInput = {
  receivableId: string;
  outcome: "settled" | "overdue";
};

export async function executeSystemPayerSettlement(
  deps: AppDeps,
  input: SystemPayerSettlementInput,
): Promise<void> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  const from = row.status as ReceivableStatus;

  let to: ReceivableStatus;
  if (from === RECEIVABLE_STATUS.COMPLETED) {
    to =
      input.outcome === "settled" ? RECEIVABLE_STATUS.PAYER_SETTLED : RECEIVABLE_STATUS.OVERDUE;
  } else if (from === RECEIVABLE_STATUS.OVERDUE && input.outcome === "settled") {
    to = RECEIVABLE_STATUS.PAYER_SETTLED;
  } else {
    throw new Error("invalid_payer_settlement_transition");
  }

  assertReceivableTransition(from, to, { kind: "system" });

  await deps.db
    .update(receivables)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(receivables.id, input.receivableId));
}
