import assert from "node:assert/strict";
import test from "node:test";

import { SELLER_ERROR_CODES, SellerError } from "../../../src/domain/seller/errors.js";
import {
  assertCanReadSeller,
  assertCanSubmitForReview,
  assertCanUpdateSellerMetadata,
  assertSellerCanCreateReceivable,
} from "../../../src/domain/seller/policies.js";

const baseSeller = {
  id: "seller-1",
  accountId: "acc-1",
  status: "created" as const,
  deletedAt: null as Date | null,
};

test("assertCanReadSeller allows own seller", () => {
  assert.doesNotThrow(() =>
    assertCanReadSeller(
      { sub: "acc-1", role: "seller", profileId: "seller-1" },
      baseSeller,
    ),
  );
});

test("assertCanReadSeller rejects other seller", () => {
  assert.throws(
    () =>
      assertCanReadSeller(
        { sub: "acc-2", role: "seller", profileId: "seller-2" },
        baseSeller,
      ),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.FORBIDDEN);
      return true;
    },
  );
});

test("assertCanReadSeller allows risk_analyst for in_review", () => {
  assert.doesNotThrow(() =>
    assertCanReadSeller(
      { sub: "ra-1", role: "risk_analyst", profileId: "placeholder" },
      { ...baseSeller, status: "in_review" },
    ),
  );
});

test("assertCanReadSeller rejects risk_analyst for active", () => {
  assert.throws(
    () =>
      assertCanReadSeller(
        { sub: "ra-1", role: "risk_analyst", profileId: "placeholder" },
        { ...baseSeller, status: "active" },
      ),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.FORBIDDEN);
      return true;
    },
  );
});

test("assertCanReadSeller allows admin for any status", () => {
  assert.doesNotThrow(() =>
    assertCanReadSeller(
      { sub: "admin-1", role: "admin", profileId: "placeholder" },
      { ...baseSeller, status: "active" },
    ),
  );
});

test("assertCanReadSeller returns not_found for soft-deleted seller", () => {
  assert.throws(
    () =>
      assertCanReadSeller(
        { sub: "acc-1", role: "seller", profileId: "seller-1" },
        { ...baseSeller, deletedAt: new Date() },
      ),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.NOT_FOUND);
      return true;
    },
  );
});

test("assertCanUpdateSellerMetadata allows own seller in created status", () => {
  assert.doesNotThrow(() =>
    assertCanUpdateSellerMetadata({ profileId: "seller-1" }, baseSeller),
  );
});

test("assertCanUpdateSellerMetadata rejects in_review status", () => {
  assert.throws(
    () =>
      assertCanUpdateSellerMetadata(
        { profileId: "seller-1" },
        { ...baseSeller, status: "in_review" },
      ),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.METADATA_LOCKED);
      return true;
    },
  );
});

test("assertCanSubmitForReview rejects non-created status", () => {
  assert.throws(
    () =>
      assertCanSubmitForReview(
        { profileId: "seller-1" },
        { ...baseSeller, status: "in_review" },
      ),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.INVALID_STATUS_FOR_SUBMIT);
      return true;
    },
  );
});

test("assertSellerCanCreateReceivable allows active non-deleted", () => {
  assert.doesNotThrow(() =>
    assertSellerCanCreateReceivable({ status: "active", deletedAt: null }),
  );
});

test("assertSellerCanCreateReceivable rejects created status", () => {
  assert.throws(
    () => assertSellerCanCreateReceivable({ status: "created", deletedAt: null }),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.NOT_ACTIVE);
      return true;
    },
  );
});

test("assertSellerCanCreateReceivable rejects soft-deleted", () => {
  assert.throws(
    () =>
      assertSellerCanCreateReceivable({ status: "active", deletedAt: new Date() }),
    SellerError,
  );
});
