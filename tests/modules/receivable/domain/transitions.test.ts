import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReceivableTransition,
  isReceivableStatus,
  LEGACY_RECEIVABLE_STATUSES,
  PLATFORM_ROLES,
  RECEIVABLE_STATUS,
  ReceivableTransitionError,
} from "../../../../src/modules/receivable/domain/transitions.js";

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

test("seller accepts offer → confirmed or rejects → rejected", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.OFFER, RECEIVABLE_STATUS.CONFIRMED, {
    kind: "user",
    role: PLATFORM_ROLES.SELLER,
  });
  assertReceivableTransition(RECEIVABLE_STATUS.OFFER, RECEIVABLE_STATUS.REJECTED, {
    kind: "user",
    role: PLATFORM_ROLES.SELLER,
  });
});

test("seller accept removed path offer → approved throws", () => {
  assert.throws(
    () =>
      assertReceivableTransition(
        RECEIVABLE_STATUS.OFFER,
        LEGACY_RECEIVABLE_STATUSES.APPROVED as never,
        {
          kind: "user",
          role: PLATFORM_ROLES.SELLER,
        },
      ),
    ReceivableTransitionError,
  );
});

test("payer_magic_link actor no longer authorizes any transition", () => {
  assert.throws(
    () =>
      assertReceivableTransition(RECEIVABLE_STATUS.OFFER, RECEIVABLE_STATUS.CONFIRMED, {
        kind: "payer_magic_link",
      } as never),
    ReceivableTransitionError,
  );
  assert.throws(
    () =>
      assertReceivableTransition(
        RECEIVABLE_STATUS.OFFER,
        RECEIVABLE_STATUS.REJECTED,
        { kind: "payer_magic_link" } as never,
      ),
    ReceivableTransitionError,
  );
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

test("system advance confirmed → funding → funded → processing", () => {
  assertReceivableTransition(RECEIVABLE_STATUS.CONFIRMED, RECEIVABLE_STATUS.FUNDING, {
    kind: "system",
  });
  assertReceivableTransition(RECEIVABLE_STATUS.FUNDING, RECEIVABLE_STATUS.FUNDED, {
    kind: "system",
  });
  assertReceivableTransition(RECEIVABLE_STATUS.FUNDED, RECEIVABLE_STATUS.PROCESSING, {
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

test("RECEIVABLE_STATUS has exactly 12 active statuses", () => {
  assert.equal(Object.keys(RECEIVABLE_STATUS).length, 12);
});

test("isReceivableStatus accepts legacy historical values", () => {
  assert.equal(isReceivableStatus(LEGACY_RECEIVABLE_STATUSES.APPROVED), true);
  assert.equal(isReceivableStatus(LEGACY_RECEIVABLE_STATUSES.PAYER_REJECTED), true);
  assert.equal(isReceivableStatus("unknown_status"), false);
});
