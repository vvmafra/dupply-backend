import assert from "node:assert/strict";
import test from "node:test";

import {
  accrualDays,
  computeSimpleInterestCents,
} from "../../../../src/modules/settlement/domain/yield.js";

test("computeSimpleInterestCents: 1% a.m. on R$ 250,00 for 15 days = 125 cents", () => {
  assert.equal(computeSimpleInterestCents(25000, 0.01, 15), 125);
});

test("computeSimpleInterestCents: full month pays exactly the monthly rate", () => {
  // R$ 10.000,00 at 1.8% a.m. for 30 days = R$ 180,00
  assert.equal(computeSimpleInterestCents(1_000_000, 0.018, 30), 18000);
});

test("computeSimpleInterestCents: rounds to the nearest cent", () => {
  // 15000 * (0.01/30) * 7 = 35 exactly; 12345 * (0.015/30) * 11 = 67.8975 → 68
  assert.equal(computeSimpleInterestCents(15000, 0.01, 7), 35);
  assert.equal(computeSimpleInterestCents(12345, 0.015, 11), 68);
});

test("computeSimpleInterestCents: zero rate, zero principal or zero days pay nothing", () => {
  assert.equal(computeSimpleInterestCents(25000, 0, 15), 0);
  assert.equal(computeSimpleInterestCents(0, 0.01, 15), 0);
  assert.equal(computeSimpleInterestCents(25000, 0.01, 0), 0);
});

test("accrualDays: whole days, minimum 1", () => {
  const t0 = new Date("2026-09-01T00:00:00Z");
  assert.equal(accrualDays(t0, new Date("2026-09-16T00:00:00Z")), 15);
  assert.equal(accrualDays(t0, new Date("2026-09-01T03:00:00Z")), 1);
  assert.equal(accrualDays(t0, t0), 1);
});
