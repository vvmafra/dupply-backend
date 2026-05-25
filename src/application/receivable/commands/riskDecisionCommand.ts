import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { receivables } from "../../../db/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../domain/receivable/errors.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../../domain/receivable/transitions.js";
import { loadReceivableOrThrow } from "../receivableHelpers.js";

export type RiskDecisionInput = {
  receivableId: string;
  actorRole: string;
  decision: "offer" | "reprove";
  proposedValue?: string;
};

export async function executeRiskDecision(deps: AppDeps, input: RiskDecisionInput): Promise<void> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  const from = row.status as ReceivableStatus;

  const to =
    input.decision === "offer" ? RECEIVABLE_STATUS.OFFER : RECEIVABLE_STATUS.REPROVED;

  if (to === RECEIVABLE_STATUS.OFFER) {
    if (!input.proposedValue?.trim()) {
      throw new ReceivableError(RECEIVABLE_ERROR_CODES.PROPOSED_VALUE_REQUIRED);
    }
  } else if (input.proposedValue?.trim()) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.PROPOSED_VALUE_FORBIDDEN);
  }

  assertReceivableTransition(from, to, { kind: "user", role: input.actorRole });

  await deps.db
    .update(receivables)
    .set({
      status: to,
      proposedValue: to === RECEIVABLE_STATUS.OFFER ? input.proposedValue!.trim() : null,
      updatedAt: new Date(),
    })
    .where(eq(receivables.id, input.receivableId));
}
