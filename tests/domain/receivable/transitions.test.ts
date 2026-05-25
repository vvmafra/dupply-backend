import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReceivableTransition,
  PLATFORM_ROLES,
  RECEIVABLE_STATUS,
  ReceivableTransitionError,
} from "../../../src/domain/receivable/transitions.js";

test("seller creates draft (implicit → created)", () => {
  assertReceivableTransition(null, RECEIVABLE_STATUS.CREATED, {
    kind: "user",
    role: PLATFORM_ROLES.SELLER,
  });
});

test("seller submits created → under_review", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.CREATED, RECEIVABLE_STATUS.UNDER_REVIEW, {
    kind: "user",
    role: PLATFORM_ROLES.SELLER,
  });
});

test("risk_analyst cannot submit", () => {
  assert.throws(
    () =>
      assertReceivableTransition(RECEIVABLE_STATUS.CREATED, RECEIVABLE_STATUS.UNDER_REVIEW, {
        kind: "user",
        role: PLATFORM_ROLES.RISK_ANALYST,
      }),
    ReceivableTransitionError,
  );
});

test("risk may offer or reprove from under_review", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.UNDER_REVIEW, RECEIVABLE_STATUS.OFFER, {
    kind: "user",
    role: PLATFORM_ROLES.RISK_ANALYST,
  });
  assertReceivableTransition(RECEIVABLE_STATUS.UNDER_REVIEW, RECEIVABLE_STATUS.REPROVED, {
    kind: "user",
    role: PLATFORM_ROLES.RISK_ANALYST_AGENT,
  });
});

test("risk cannot move under_review → rejected", () => {
  assert.throws(
    () =>
      assertReceivableTransition(RECEIVABLE_STATUS.UNDER_REVIEW, RECEIVABLE_STATUS.REJECTED, {
        kind: "user",
        role: PLATFORM_ROLES.RISK_ANALYST,
      }),
    ReceivableTransitionError,
  );
});

test("seller accepts or rejects offer", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.OFFER, RECEIVABLE_STATUS.APPROVED, {
    kind: "user",
    role: PLATFORM_ROLES.SELLER,
  });
  assertReceivableTransition(RECEIVABLE_STATUS.OFFER, RECEIVABLE_STATUS.REJECTED, {
    kind: "user",
    role: PLATFORM_ROLES.SELLER,
  });
});

test("payer magic link accept/reject from approved", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.APPROVED, RECEIVABLE_STATUS.CONFIRMED, {
    kind: "payer_magic_link",
  });
  assertReceivableTransition(RECEIVABLE_STATUS.APPROVED, RECEIVABLE_STATUS.PAYER_REJECTED, {
    kind: "payer_magic_link",
  });
});

test("system advance confirmed → processing → completed", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.CONFIRMED, RECEIVABLE_STATUS.PROCESSING, {
    kind: "system",
  });
  assertReceivableTransition(RECEIVABLE_STATUS.PROCESSING, RECEIVABLE_STATUS.COMPLETED, {
    kind: "system",
  });
});

test("system payer settlement paths", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.COMPLETED, RECEIVABLE_STATUS.PAYER_SETTLED, {
    kind: "system",
  });
  assertReceivableTransition(RECEIVABLE_STATUS.COMPLETED, RECEIVABLE_STATUS.OVERDUE, {
    kind: "system",
  });
  assertReceivableTransition(RECEIVABLE_STATUS.OVERDUE, RECEIVABLE_STATUS.PAYER_SETTLED, {
    kind: "system",
  });
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
});

test("terminal re-entry reproved → under_review throws", () => {
  assert.throws(
    () =>
      assertReceivableTransition(RECEIVABLE_STATUS.REPROVED, RECEIVABLE_STATUS.UNDER_REVIEW, {
        kind: "user",
        role: PLATFORM_ROLES.RISK_ANALYST,
      }),
    ReceivableTransitionError,
  );
});

test("all 12 statuses exist", () => {
  assert.equal(Object.keys(RECEIVABLE_STATUS).length, 12);
});
