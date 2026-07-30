export const INVESTOR_ERROR_CODES = {
  NOT_FOUND: "investor_not_found",
  IDEMPOTENCY_CONFLICT: "deposit_idempotency_conflict",
  INVALID_AMOUNT: "invalid_amount",
} as const;

export type InvestorErrorCode =
  (typeof INVESTOR_ERROR_CODES)[keyof typeof INVESTOR_ERROR_CODES];

export class InvestorError extends Error {
  constructor(readonly code: InvestorErrorCode) {
    super(code);
    this.name = "InvestorError";
  }
}
