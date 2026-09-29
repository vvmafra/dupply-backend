import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { receivables } from "../../../../infra/database/schema.runtime.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../domain/transitions.js";
import { appendStatusHistory, loadReceivableOrThrow } from "../receivableHelpers.js";

export type SystemAdvanceInput = {
  receivableId: string;
  targetStatus: typeof RECEIVABLE_STATUS.PROCESSING | typeof RECEIVABLE_STATUS.COMPLETED;
};

export async function executeSystemAdvanceSettlement(
  deps: AppDeps,
  input: SystemAdvanceInput,
): Promise<void> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  const from = row.status as ReceivableStatus;
  assertReceivableTransition(from, input.targetStatus, { kind: "system" });

  await deps.db
    .update(receivables)
    .set({
      status: input.targetStatus,
      statusHistory: appendStatusHistory(row.statusHistory, input.targetStatus),
      updatedAt: new Date(),
    })
    .where(eq(receivables.id, input.receivableId));
}
