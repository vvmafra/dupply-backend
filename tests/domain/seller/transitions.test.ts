import assert from "node:assert/strict";
import test from "node:test";

import { SELLER_ERROR_CODES, SellerError } from "../../../src/domain/seller/errors.js";
import { assertSellerStatusTransition } from "../../../src/domain/seller/transitions.js";

test("created → in_review by seller passes", () => {
  assert.doesNotThrow(() =>
    assertSellerStatusTransition("created", "in_review", {
      kind: "seller",
      accountId: "acc-1",
    }),
  );
});

test("created → in_review by admin throws forbidden", () => {
  assert.throws(
    () =>
      assertSellerStatusTransition("created", "in_review", {
        kind: "admin",
      }),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.FORBIDDEN);
      return true;
    },
  );
});

test("in_review → active by admin passes", () => {
  assert.doesNotThrow(() =>
    assertSellerStatusTransition("in_review", "active", {
      kind: "reviewer",
      role: "admin",
    }),
  );
});

test("in_review → active by seller throws forbidden", () => {
  assert.throws(
    () =>
      assertSellerStatusTransition("in_review", "active", {
        kind: "seller",
        accountId: "acc-1",
      }),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.FORBIDDEN);
      return true;
    },
  );
});

test("in_review → inactive by admin passes", () => {
  assert.doesNotThrow(() =>
    assertSellerStatusTransition("in_review", "inactive", {
      kind: "reviewer",
      role: "admin",
    }),
  );
});

test("active → inactive by admin passes", () => {
  assert.doesNotThrow(() =>
    assertSellerStatusTransition("active", "inactive", { kind: "admin" }),
  );
});

test("inactive → active by admin passes", () => {
  assert.doesNotThrow(() =>
    assertSellerStatusTransition("inactive", "active", { kind: "admin" }),
  );
});

test("created → active by admin throws invalid_status_transition", () => {
  assert.throws(
    () => assertSellerStatusTransition("created", "active", { kind: "admin" }),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.INVALID_STATUS_TRANSITION);
      return true;
    },
  );
});

test("active → in_review throws invalid_status_transition", () => {
  assert.throws(
    () =>
      assertSellerStatusTransition("active", "in_review", {
        kind: "seller",
        accountId: "acc-1",
      }),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.INVALID_STATUS_TRANSITION);
      return true;
    },
  );
});
