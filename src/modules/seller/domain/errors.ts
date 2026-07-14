export const SELLER_ERROR_CODES = {
  NOT_FOUND: "seller_not_found",
  FORBIDDEN: "forbidden",
  METADATA_LOCKED: "metadata_locked",
  VALIDATION_ERROR: "validation_error",
  INCOMPLETE_METADATA: "incomplete_metadata",
  INVALID_STATUS_TRANSITION: "invalid_status_transition",
  INVALID_STATUS_FOR_SUBMIT: "invalid_status_for_submit",
  NOT_ACTIVE: "seller_not_active",
} as const;

export type SellerErrorCode = (typeof SELLER_ERROR_CODES)[keyof typeof SELLER_ERROR_CODES];

export class SellerError extends Error {
  constructor(readonly code: SellerErrorCode) {
    super(code);
    this.name = "SellerError";
  }
}
