import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { notifyPayerReceivableConfirmed } from "../../payer/ports/receivableNotification.js";
import { receivables } from "../../../db/schema.runtime.js";
import { assertSellerOwnsReceivable } from "../../../domain/receivable/policies.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../../domain/receivable/transitions.js";
import { loadReceivableOrThrow } from "../receivableHelpers.js";

export type SellerDecisionInput = {
  receivableId: string;
  profileId: string;
  actorRole: string;
  decision: "accept" | "reject";
};

export async function executeSellerDecision(
  deps: AppDeps,
  input: SellerDecisionInput,
): Promise<void> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  assertSellerOwnsReceivable({ profileId: input.profileId }, row);

  const from = row.status as ReceivableStatus;
  const to =
    input.decision === "accept" ? RECEIVABLE_STATUS.CONFIRMED : RECEIVABLE_STATUS.REJECTED;

  assertReceivableTransition(from, to, { kind: "user", role: input.actorRole });

  await deps.db
    .update(receivables)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(receivables.id, input.receivableId));

  if (to === RECEIVABLE_STATUS.CONFIRMED) {
    const notify = deps.notifyPayerReceivableConfirmed ?? notifyPayerReceivableConfirmed;
    try {
      await notify(deps, {
        receivableId: input.receivableId,
        payerId: row.payerId,
      });
    } catch (err) {
      deps.logger?.warn?.({ err, receivableId: input.receivableId }, "payer_notification_failed");
    }
  }
}
