import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { receivables } from "../../../../infra/database/schema.runtime.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../domain/transitions.js";
import { appendStatusHistory, loadReceivableOrThrow } from "../receivableHelpers.js";

export type AdminOpenFundingInput = {
  receivableId: string;
};

export type AdminOpenFundingResult = {
  from: ReceivableStatus;
  to: typeof RECEIVABLE_STATUS.FUNDING;
  targetFundingCents: number;
};

function parseCentsText(value: string | null): number {
  if (value == null) return 0;
  const cents = Number.parseInt(value, 10);
  return Number.isNaN(cents) ? 0 : cents;
}

/**
 * Admin trigger for `confirmed → funding`. The transition itself stays system-only in the
 * domain: the admin action is the trigger, not the actor. Sets `targetFundingCents` from
 * `proposedValue` (fallback `value`) when it is still 0; `fundedCents` is left untouched.
 */
export async function executeAdminOpenFunding(
  deps: AppDeps,
  input: AdminOpenFundingInput,
): Promise<AdminOpenFundingResult> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  const from = row.status as ReceivableStatus;
  const to = RECEIVABLE_STATUS.FUNDING;

  assertReceivableTransition(from, to, { kind: "system" });

  const targetFundingCents =
    row.targetFundingCents > 0
      ? row.targetFundingCents
      : parseCentsText(row.proposedValue) || parseCentsText(row.value);

  await deps.db
    .update(receivables)
    .set({
      status: to,
      targetFundingCents,
      statusHistory: appendStatusHistory(row.statusHistory, to),
      updatedAt: new Date(),
    })
    .where(eq(receivables.id, input.receivableId));

  return { from, to, targetFundingCents };
}
