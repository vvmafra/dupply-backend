import { RECEIVABLE_ERROR_CODES, ReceivableError } from "./errors.js";
import type { ReceivableMetaData } from "./types.js";

const REQUIRED_STRING_FIELDS: (keyof ReceivableMetaData)[] = [
  "type",
  "billNumber",
  "invoiceNumber",
  "issuedAt",
  "dueDate",
  "payerCnpj",
  "payerLegalName",
  "payerFinancialEmail",
  "fiscalDocumentType",
  "fiscalDocumentKey",
  "proofType",
  "payerAcceptanceStatus",
];

export function parseReceivableMetaData(raw: string | null): ReceivableMetaData | null {
  if (!raw) return null;
  return JSON.parse(raw) as ReceivableMetaData;
}

export function assertReceivableMetaDataComplete(raw: string | null): ReceivableMetaData {
  const meta = parseReceivableMetaData(raw);
  if (!meta) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    if (!meta[field] || String(meta[field]).trim() === "") {
      throw new ReceivableError(RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
    }
  }
  if (meta.antifraudDeclarationsAccepted !== true) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
  }
  if (typeof meta.desiredAnticipationValue !== "number" || meta.desiredAnticipationValue <= 0) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
  }
  return meta;
}
