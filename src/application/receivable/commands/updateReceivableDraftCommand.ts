import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { receivables } from "../../../db/schema.runtime.js";
import {
  assertCanUpdateReceivableDraft,
  assertSellerOwnsReceivable,
} from "../../../domain/receivable/policies.js";
import { parseReceivableMetaData } from "../../../domain/receivable/metadata.js";
import type { ReceivableMetaData } from "../../../domain/receivable/types.js";
import { loadReceivableOrThrow } from "../receivableHelpers.js";

export type UpdateReceivableDraftInput = {
  receivableId: string;
  profileId: string;
  value?: string;
  receivableMetaData?: Partial<ReceivableMetaData>;
};

export async function executeUpdateReceivableDraft(
  deps: AppDeps,
  input: UpdateReceivableDraftInput,
): Promise<void> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  assertSellerOwnsReceivable({ profileId: input.profileId }, row);
  assertCanUpdateReceivableDraft(row);

  const existing = parseReceivableMetaData(row.receivableMetaData) ?? {};
  const merged =
    input.receivableMetaData !== undefined
      ? { ...existing, ...input.receivableMetaData }
      : existing;
  const receivableMetaData =
    input.receivableMetaData !== undefined ? JSON.stringify(merged) : row.receivableMetaData;

  await deps.db
    .update(receivables)
    .set({
      value: input.value?.trim() ?? row.value,
      receivableMetaData,
      updatedAt: new Date(),
    })
    .where(eq(receivables.id, input.receivableId));
}
