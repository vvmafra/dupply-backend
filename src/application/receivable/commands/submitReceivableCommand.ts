import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { receivables } from "../../../db/schema.runtime.js";
import { assertReceivableMetaDataComplete } from "../../../domain/receivable/metadata.js";
import { assertSellerOwnsReceivable } from "../../../domain/receivable/policies.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../../domain/receivable/transitions.js";
import { loadReceivableOrThrow } from "../receivableHelpers.js";

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
  assertReceivableMetaDataComplete(row.receivableMetaData);

  const from = row.status as ReceivableStatus;
  assertReceivableTransition(from, RECEIVABLE_STATUS.UNDER_REVIEW, {
    kind: "user",
    role: input.actorRole,
  });

  await deps.db
    .update(receivables)
    .set({ status: RECEIVABLE_STATUS.UNDER_REVIEW, updatedAt: new Date() })
    .where(eq(receivables.id, input.receivableId));
}
