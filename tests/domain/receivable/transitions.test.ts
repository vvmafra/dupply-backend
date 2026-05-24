import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReceivableTransition,
  PLATFORM_ROLES,
  RECEIVABLE_STATUS,
  ReceivableTransitionError,
} from "../../../src/domain/receivable/transitions.js";

test("risk may offer from under_review", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.UNDER_REVIEW, RECEIVABLE_STATUS.OFFER, {
    kind: "user",
    role: PLATFORM_ROLES.RISK_ANALYST,
  });
});

test("seller cannot offer", () => {
  assert.throws(
    () =>
      assertReceivableTransition(RECEIVABLE_STATUS.UNDER_REVIEW, RECEIVABLE_STATUS.OFFER, {
        kind: "user",
        role: PLATFORM_ROLES.SELLER,
      }),
    ReceivableTransitionError,
  );
});

test("processing requires system actor", () => {
  assert.throws(
    () =>
      assertReceivableTransition(RECEIVABLE_STATUS.CONFIRMED, RECEIVABLE_STATUS.PROCESSING, {
        kind: "user",
        role: PLATFORM_ROLES.ADMIN,
      }),
    ReceivableTransitionError,
  );
  assertReceivableTransition(RECEIVABLE_STATUS.CONFIRMED, RECEIVABLE_STATUS.PROCESSING, {
    kind: "system",
  });
});

test("payer confirms from offer", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.OFFER, RECEIVABLE_STATUS.CONFIRMED, {
    kind: "user",
    role: PLATFORM_ROLES.PAYER,
  });
});
