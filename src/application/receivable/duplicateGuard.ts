import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";

import type { AppDeps } from "../deps.js";
import { receivables } from "../../db/schema.runtime.js";
import type { MaterializedBusinessKeys } from "../../domain/receivable/businessKey.js";
import { DUPLICATE_BLOCKING_STATUSES } from "../../domain/receivable/businessKey.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../domain/receivable/errors.js";

export type AssertNoDuplicateInput = {
  sellerId: string;
  keys: MaterializedBusinessKeys;
  excludeReceivableId?: string;
};

export async function assertNoActiveReceivableDuplicate(
  deps: AppDeps,
  input: AssertNoDuplicateInput,
): Promise<void> {
  const { normalizedBillNumber, normalizedFiscalDocumentKey } = input.keys;
  if (!normalizedBillNumber && !normalizedFiscalDocumentKey) return;

  const conditions = [
    eq(receivables.sellerId, input.sellerId),
    isNull(receivables.deletedAt),
    inArray(receivables.status, [...DUPLICATE_BLOCKING_STATUSES]),
  ];
  if (input.excludeReceivableId) {
    conditions.push(ne(receivables.id, input.excludeReceivableId));
  }

  const keyMatch = or(
    normalizedBillNumber
      ? eq(receivables.normalizedBillNumber, normalizedBillNumber)
      : undefined,
    normalizedFiscalDocumentKey
      ? eq(receivables.normalizedFiscalDocumentKey, normalizedFiscalDocumentKey)
      : undefined,
  );
  if (!keyMatch) return;

  const [collision] = await deps.db
    .select()
    .from(receivables)
    .where(and(...conditions, keyMatch))
    .limit(1);

  if (!collision) return;

  if (
    normalizedBillNumber &&
    collision.normalizedBillNumber === normalizedBillNumber
  ) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.DUPLICATE_BILL_NUMBER);
  }
  throw new ReceivableError(RECEIVABLE_ERROR_CODES.DUPLICATE_FISCAL_KEY);
}

export function isReceivableUniqueViolation(error: unknown): "bill" | "fiscal" | null {
  if (!(error instanceof Error)) return null;
  const msg = error.message.toLowerCase();
  if (!msg.includes("unique") && !msg.includes("constraint")) return null;
  if (msg.includes("receivables_seller_bill_active_unique")) return "bill";
  if (msg.includes("receivables_seller_fiscal_key_active_unique")) return "fiscal";
  return "bill";
}
