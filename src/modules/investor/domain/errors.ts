export const INVESTOR_ERROR_CODES = {
  NOT_FOUND: "investor_not_found",
  IDEMPOTENCY_CONFLICT: "deposit_idempotency_conflict",
  WITHDRAW_IDEMPOTENCY_CONFLICT: "withdraw_idempotency_conflict",
  INVALID_AMOUNT: "invalid_amount",
  INSUFFICIENT_FUNDS: "insufficient_funds",
  RECEIVABLE_NOT_FOUND: "receivable_not_found",
  RECEIVABLE_NOT_OPEN_FOR_FUNDING: "receivable_not_open_for_funding",
  INVESTMENT_EXCEEDS_REMAINING_FUNDING: "investment_exceeds_remaining_funding",
  INVEST_IDEMPOTENCY_CONFLICT: "invest_idempotency_conflict",
} as const;

export type InvestorErrorCode =
  (typeof INVESTOR_ERROR_CODES)[keyof typeof INVESTOR_ERROR_CODES];

export class InvestorError extends Error {
  constructor(readonly code: InvestorErrorCode) {
    super(code);
    this.name = "InvestorError";
  }
}
