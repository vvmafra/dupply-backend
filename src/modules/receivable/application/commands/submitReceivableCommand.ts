import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { receivables } from "../../../../infra/database/schema.runtime.js";
import { assertReceivableMetaDataComplete } from "../../domain/metadata.js";
import { assertSellerOwnsReceivable } from "../../domain/policies.js";
import { deriveMaterializedBusinessKeys } from "../../domain/businessKey.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../domain/transitions.js";
import { assertNoActiveReceivableDuplicate } from "../duplicateGuard.js";
import { loadReceivableOrThrow, appendStatusHistory } from "../receivableHelpers.js";

export type SubmitReceivableInput = {
  receivableId: string;
  profileId: string;
  actorRole: string;
};

export async function executeSubmitReceivable(
  deps: AppDeps,
  input: SubmitReceivableInput,
): Promise<void> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  assertSellerOwnsReceivable({ profileId: input.profileId }, row);
  const meta = assertReceivableMetaDataComplete(row.receivableMetaData);
  const keys = deriveMaterializedBusinessKeys(meta);

  await assertNoActiveReceivableDuplicate(deps, {
    sellerId: row.sellerId,
    keys,
    excludeReceivableId: input.receivableId,
  });

  const from = row.status as ReceivableStatus;
  assertReceivableTransition(from, RECEIVABLE_STATUS.UNDER_REVIEW, {
    kind: "user",
    role: input.actorRole,
  });

  await deps.db
    .update(receivables)
    .set({
      status: RECEIVABLE_STATUS.UNDER_REVIEW,
      statusHistory: appendStatusHistory(row.statusHistory, RECEIVABLE_STATUS.UNDER_REVIEW),
      updatedAt: new Date(),
    })
    .where(eq(receivables.id, input.receivableId));
}
