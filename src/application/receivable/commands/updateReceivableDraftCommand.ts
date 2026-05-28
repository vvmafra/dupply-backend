import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { receivables } from "../../../db/schema.runtime.js";
import {
  assertCanUpdateReceivableDraft,
  assertSellerOwnsReceivable,
} from "../../../domain/receivable/policies.js";
import { deriveMaterializedBusinessKeys } from "../../../domain/receivable/businessKey.js";
import { parseReceivableMetaData } from "../../../domain/receivable/metadata.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../domain/receivable/errors.js";
import type { ReceivableMetaData } from "../../../domain/receivable/types.js";
import {
  assertNoActiveReceivableDuplicate,
  isReceivableUniqueViolation,
} from "../duplicateGuard.js";
import {
  loadReceivableOrThrow,
  metaApiToStored,
  prepareReceivableMetaDataForWrite,
  valueReaisToDbCentsText,
} from "../receivableHelpers.js";

export type UpdateReceivableDraftInput = {
  receivableId: string;
  profileId: string;
  value?: number;
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
      ? { ...existing, ...metaApiToStored(input.receivableMetaData) }
      : existing;

  const { receivableMetaData, materializedKeys } =
    input.receivableMetaData !== undefined
      ? prepareReceivableMetaDataForWrite(merged)
      : {
          receivableMetaData: row.receivableMetaData,
          materializedKeys: deriveMaterializedBusinessKeys(
            parseReceivableMetaData(row.receivableMetaData),
          ),
        };

  if (input.receivableMetaData !== undefined) {
    await assertNoActiveReceivableDuplicate(deps, {
      sellerId: row.sellerId,
      keys: materializedKeys,
      excludeReceivableId: input.receivableId,
    });
  }

  try {
    await deps.db
      .update(receivables)
      .set({
        value: input.value !== undefined ? valueReaisToDbCentsText(input.value) : row.value,
        receivableMetaData,
        normalizedBillNumber: materializedKeys.normalizedBillNumber,
        normalizedFiscalDocumentKey: materializedKeys.normalizedFiscalDocumentKey,
        updatedAt: new Date(),
      })
      .where(eq(receivables.id, input.receivableId));
  } catch (error) {
    const violation = isReceivableUniqueViolation(error);
    if (violation === "bill") {
      throw new ReceivableError(RECEIVABLE_ERROR_CODES.DUPLICATE_BILL_NUMBER);
    }
    if (violation === "fiscal") {
      throw new ReceivableError(RECEIVABLE_ERROR_CODES.DUPLICATE_FISCAL_KEY);
    }
    throw error;
  }
}
