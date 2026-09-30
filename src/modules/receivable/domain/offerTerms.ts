import { RECEIVABLE_ERROR_CODES, ReceivableError } from "./errors.js";

/** Upper bound for a monthly rate (fraction). 10% a.m. is already far outside market. */
export const MAX_YIELD_RATE_MONTHLY = 0.1;

/**
 * Funding terms attached to an offer. Rates are fractions (0.018 = 1.8% a.m.),
 * amounts are integer cents. `0` means "not set" for both.
 */
export type OfferTerms = {
  yieldRateMonthly: number;
  minInvestmentCents: number;
};

export type OfferTermsInput = Partial<OfferTerms> & {
  /** Funding target the minimum ticket must fit into (cents). */
  targetCents: number;
};

/**
 * Validates and normalises offer terms. Missing values fall back to `current` (or 0).
 * Throws `invalid_offer_terms` when a rate is out of range or the minimum ticket is
 * larger than the funding target.
 */
export function resolveOfferTerms(input: OfferTermsInput, current?: OfferTerms): OfferTerms {
  const yieldRateMonthly = input.yieldRateMonthly ?? current?.yieldRateMonthly ?? 0;
  const minInvestmentCents = input.minInvestmentCents ?? current?.minInvestmentCents ?? 0;

  if (
    !Number.isFinite(yieldRateMonthly) ||
    yieldRateMonthly < 0 ||
    yieldRateMonthly > MAX_YIELD_RATE_MONTHLY
  ) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.INVALID_OFFER_TERMS);
  }
  if (!Number.isInteger(minInvestmentCents) || minInvestmentCents < 0) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.INVALID_OFFER_TERMS);
  }
  if (input.targetCents > 0 && minInvestmentCents > input.targetCents) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.INVALID_OFFER_TERMS);
  }

  return { yieldRateMonthly, minInvestmentCents };
}
