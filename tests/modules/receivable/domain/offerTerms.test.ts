import assert from "node:assert/strict";
import test from "node:test";

import {
  RECEIVABLE_ERROR_CODES,
  ReceivableError,
} from "../../../../src/modules/receivable/domain/errors.js";
import {
  MAX_YIELD_RATE_MONTHLY,
  resolveOfferTerms,
} from "../../../../src/modules/receivable/domain/offerTerms.js";

const invalid = (e: unknown) =>
  e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.INVALID_OFFER_TERMS;

test("resolveOfferTerms: defaults to 0 / 0 when nothing is given", () => {
  assert.deepEqual(resolveOfferTerms({ targetCents: 90000 }), {
    yieldRateMonthly: 0,
    minInvestmentCents: 0,
  });
});

test("resolveOfferTerms: keeps current values when input omits them", () => {
  const current = { yieldRateMonthly: 0.018, minInvestmentCents: 10000 };
  assert.deepEqual(resolveOfferTerms({ targetCents: 90000 }, current), current);
  assert.deepEqual(resolveOfferTerms({ targetCents: 90000, yieldRateMonthly: 0.02 }, current), {
    yieldRateMonthly: 0.02,
    minInvestmentCents: 10000,
  });
});

test("resolveOfferTerms: rate must be within [0, MAX_YIELD_RATE_MONTHLY]", () => {
  assert.throws(() => resolveOfferTerms({ targetCents: 1, yieldRateMonthly: -0.01 }), invalid);
  assert.throws(
    () => resolveOfferTerms({ targetCents: 1, yieldRateMonthly: MAX_YIELD_RATE_MONTHLY + 0.001 }),
    invalid,
  );
  assert.throws(() => resolveOfferTerms({ targetCents: 1, yieldRateMonthly: Number.NaN }), invalid);
  assert.equal(
    resolveOfferTerms({ targetCents: 1, yieldRateMonthly: MAX_YIELD_RATE_MONTHLY }).yieldRateMonthly,
    MAX_YIELD_RATE_MONTHLY,
  );
});

test("resolveOfferTerms: minimum ticket must be a non-negative integer not above the target", () => {
  assert.throws(() => resolveOfferTerms({ targetCents: 90000, minInvestmentCents: -1 }), invalid);
  assert.throws(() => resolveOfferTerms({ targetCents: 90000, minInvestmentCents: 10.5 }), invalid);
  assert.throws(() => resolveOfferTerms({ targetCents: 90000, minInvestmentCents: 90001 }), invalid);
  assert.equal(
    resolveOfferTerms({ targetCents: 90000, minInvestmentCents: 90000 }).minInvestmentCents,
    90000,
  );
  // unknown target (0) skips the ceiling check
  assert.equal(
    resolveOfferTerms({ targetCents: 0, minInvestmentCents: 90001 }).minInvestmentCents,
    90001,
  );
});
