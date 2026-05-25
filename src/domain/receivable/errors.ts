export const RECEIVABLE_ERROR_CODES = {
  NOT_FOUND: "receivable_not_found",
  FORBIDDEN: "forbidden",
  NOT_OWNER: "not_owner",
  METADATA_LOCKED: "metadata_locked",
  INCOMPLETE_METADATA: "incomplete_metadata",
  SELLER_PAYER_MUST_DIFFER: "seller_and_payer_must_differ",
  PROPOSED_VALUE_REQUIRED: "proposed_value_required_for_offer",
  PROPOSED_VALUE_FORBIDDEN: "proposed_value_not_allowed_for_reprove",
  SOFT_DELETED: "receivable_deleted",
} as const;

export type ReceivableErrorCode =
  (typeof RECEIVABLE_ERROR_CODES)[keyof typeof RECEIVABLE_ERROR_CODES];

export class ReceivableError extends Error {
  constructor(readonly code: ReceivableErrorCode) {
    super(code);
    this.name = "ReceivableError";
  }
}
