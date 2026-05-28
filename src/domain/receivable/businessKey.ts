import type { ReceivableMetaData } from "./types.js";
import { RECEIVABLE_STATUS, type ReceivableStatus } from "./transitions.js";

/** Statuses that block a duplicate for the same business key (FR-7). */
export const DUPLICATE_BLOCKING_STATUSES: readonly ReceivableStatus[] = [
  RECEIVABLE_STATUS.CREATED,
  RECEIVABLE_STATUS.UNDER_REVIEW,
  RECEIVABLE_STATUS.OFFER,
  RECEIVABLE_STATUS.APPROVED,
  RECEIVABLE_STATUS.CONFIRMED,
  RECEIVABLE_STATUS.PROCESSING,
  RECEIVABLE_STATUS.COMPLETED,
  RECEIVABLE_STATUS.OVERDUE,
] as const;

/** Terminal for duplicate purposes — resubmission allowed (FR-6). */
export const DUPLICATE_TERMINAL_STATUSES: readonly ReceivableStatus[] = [
  RECEIVABLE_STATUS.REPROVED,
  RECEIVABLE_STATUS.REJECTED,
  RECEIVABLE_STATUS.PAYER_REJECTED,
  RECEIVABLE_STATUS.PAYER_SETTLED,
] as const;

export function isDuplicateBlockingStatus(status: string): boolean {
  return (DUPLICATE_BLOCKING_STATUSES as readonly string[]).includes(status);
}

/** Trim + uppercase — avoids casing/whitespace bypass (OQ-2). */
export function normalizeBillNumber(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * NF-e / NFC-e / NFS-e access keys → digits-only (44 chars).
 * fiscalDocumentType = 'other' → trim only (alphanumeric doc numbers) (OQ-3).
 */
export function normalizeFiscalDocumentKey(
  raw: string,
  fiscalDocumentType?: ReceivableMetaData["fiscalDocumentType"],
): string {
  const trimmed = raw.trim();
  if (fiscalDocumentType === "other") return trimmed;
  return trimmed.replace(/\D/g, "");
}

export type MaterializedBusinessKeys = {
  normalizedBillNumber: string | null;
  normalizedFiscalDocumentKey: string | null;
};

/** Returns null for each key when source field is missing or empty after normalization (OQ-6). */
export function deriveMaterializedBusinessKeys(
  meta: Partial<ReceivableMetaData> | null | undefined,
): MaterializedBusinessKeys {
  if (!meta) {
    return { normalizedBillNumber: null, normalizedFiscalDocumentKey: null };
  }

  let normalizedBillNumber: string | null = null;
  if (meta.billNumber && meta.billNumber.trim() !== "") {
    normalizedBillNumber = normalizeBillNumber(meta.billNumber);
  }

  let normalizedFiscalDocumentKey: string | null = null;
  if (meta.fiscalDocumentKey && meta.fiscalDocumentKey.trim() !== "") {
    normalizedFiscalDocumentKey = normalizeFiscalDocumentKey(
      meta.fiscalDocumentKey,
      meta.fiscalDocumentType,
    );
  }

  return { normalizedBillNumber, normalizedFiscalDocumentKey };
}

/** Apply normalization into metadata before JSON persistence (FR-5). */
export function normalizeReceivableMetaDataForStorage(
  meta: Partial<ReceivableMetaData>,
): Partial<ReceivableMetaData> {
  const out = { ...meta };
  if (out.billNumber !== undefined && out.billNumber.trim() !== "") {
    out.billNumber = normalizeBillNumber(out.billNumber);
  }
  if (out.fiscalDocumentKey !== undefined && out.fiscalDocumentKey.trim() !== "") {
    out.fiscalDocumentKey = normalizeFiscalDocumentKey(
      out.fiscalDocumentKey,
      out.fiscalDocumentType,
    );
  }
  if (out.payerCnpj !== undefined) {
    out.payerCnpj = out.payerCnpj.replace(/\D/g, "");
  }
  return out;
}
