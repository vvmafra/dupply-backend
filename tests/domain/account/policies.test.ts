import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_ERROR_CODES,
  AUTH_ERROR_CODES,
  AccountError,
  AuthError,
} from "../../../src/domain/account/errors.js";
import { mockProfileId } from "../../../src/domain/account/profileId.js";
import {
  assertCanAuthenticate,
  assertCanMutateAccount,
  assertCanReadAccount,
  assertCanSoftDeleteAccount,
  requireLoginCandidate,
} from "../../../src/domain/account/policies.js";
import type { AccountAuthSnapshot } from "../../../src/domain/account/types.js";

const activeAccount: AccountAuthSnapshot = {
  id: "acc-1",
  email: "seller@example.com",
  role: "seller",
  status: "active",
  passwordHash: "hash",
  refreshToken: null,
  deletedAt: null,
};

test("requireLoginCandidate returns account when present", () => {
  const account = requireLoginCandidate(activeAccount);
  assert.equal(account.id, "acc-1");
});

test("requireLoginCandidate rejects missing account", () => {
  assert.throws(() => requireLoginCandidate(undefined), (e: unknown) => {
    assert.ok(e instanceof AuthError);
    assert.equal(e.code, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    return true;
  });
});

test("assertCanAuthenticate rejects deleted accounts", () => {
  assert.throws(
    () =>
      assertCanAuthenticate({
        ...activeAccount,
        deletedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    (e: unknown) => {
      assert.ok(e instanceof AuthError);
      assert.equal(e.code, AUTH_ERROR_CODES.ACCOUNT_DELETED);
      return true;
    },
  );
});

test("assertCanAuthenticate rejects inactive accounts", () => {
  assert.throws(
    () => assertCanAuthenticate({ ...activeAccount, status: "inactive" }),
    (e: unknown) => {
      assert.ok(e instanceof AuthError);
      assert.equal(e.code, AUTH_ERROR_CODES.ACCOUNT_INACTIVE);
      return true;
    },
  );
});

test("assertCanAuthenticate passes for active non-deleted account", () => {
  assert.doesNotThrow(() => assertCanAuthenticate(activeAccount));
});

test("assertCanReadAccount allows account owner", () => {
  assert.doesNotThrow(() =>
    assertCanReadAccount({ sub: "acc-1", role: "seller" }, "acc-1"),
  );
});

test("assertCanReadAccount allows admin", () => {
  assert.doesNotThrow(() =>
    assertCanReadAccount({ sub: "admin-1", role: "admin" }, "acc-1"),
  );
});

test("assertCanReadAccount rejects other users", () => {
  assert.throws(
    () => assertCanReadAccount({ sub: "acc-2", role: "seller" }, "acc-1"),
    (e: unknown) => {
      assert.ok(e instanceof AccountError);
      assert.equal(e.code, ACCOUNT_ERROR_CODES.FORBIDDEN);
      return true;
    },
  );
});

test("assertCanMutateAccount delegates to assertCanReadAccount", () => {
  assert.doesNotThrow(() =>
    assertCanMutateAccount({ sub: "acc-1", role: "seller" }, "acc-1"),
  );

  assert.throws(
    () => assertCanMutateAccount({ sub: "acc-2", role: "risk_analyst" }, "acc-1"),
    AccountError,
  );
});

test("assertCanSoftDeleteAccount rejects non-admin", () => {
  assert.throws(
    () => assertCanSoftDeleteAccount({ role: "seller" }),
    (e: unknown) => {
      assert.ok(e instanceof AccountError);
      assert.equal(e.code, ACCOUNT_ERROR_CODES.FORBIDDEN);
      return true;
    },
  );
});

test("assertCanSoftDeleteAccount allows admin", () => {
  assert.doesNotThrow(() => assertCanSoftDeleteAccount({ role: "admin" }));
});

test("mockProfileId returns placeholder format", () => {
  assert.equal(mockProfileId("acc-1", "seller"), "placeholder-seller-acc-1");
});
