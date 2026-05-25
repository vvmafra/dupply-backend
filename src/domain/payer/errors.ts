export const PAYER_ERROR_CODES = {
  NOT_FOUND: "payer_not_found",
  INACTIVE: "payer_inactive",
  INVALID_TOKEN: "invalid_magic_link_token",
  MISSING_FIELDS: "payer_fields_required",
} as const;

export type PayerErrorCode = (typeof PAYER_ERROR_CODES)[keyof typeof PAYER_ERROR_CODES];

export class PayerError extends Error {
  constructor(readonly code: PayerErrorCode) {
    super(code);
    this.name = "PayerError";
  }
}
