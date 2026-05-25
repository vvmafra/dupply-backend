import assert from "node:assert/strict";
import test from "node:test";

import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../src/domain/receivable/errors.js";
import {
  assertCanUpdateReceivableDraft,
  assertCanViewReceivable,
  assertSellerOwnsReceivable,
  assertSellerPayerCnpjDiffer,
} from "../../../src/domain/receivable/policies.js";
import { RECEIVABLE_STATUS } from "../../../src/domain/receivable/transitions.js";

test("seller views own receivable", () => {
  assert.equal(
    assertCanViewReceivable({ profileId: "seller-1", role: "seller" }, { sellerId: "seller-1" }),
    true,
  );
});

test("seller cannot view other's receivable", () => {
  assert.equal(
    assertCanViewReceivable({ profileId: "seller-1", role: "seller" }, { sellerId: "seller-2" }),
    false,
  );
});

test("payer cannot view receivable via GET policy", () => {
  assert.equal(
    assertCanViewReceivable({ profileId: "payer-1", role: "payer" }, { sellerId: "seller-1" }),
    false,
  );
});

test("admin can view any receivable", () => {
  assert.equal(
    assertCanViewReceivable({ profileId: "admin-1", role: "admin" }, { sellerId: "seller-1" }),
    true,
  );
});

test("PATCH policy rejects non-created status", () => {
  assert.throws(
    () =>
      assertCanUpdateReceivableDraft({
        status: RECEIVABLE_STATUS.UNDER_REVIEW,
        deletedAt: null,
      }),
    (e: unknown) => {
      assert.ok(e instanceof ReceivableError);
      assert.equal(e.code, RECEIVABLE_ERROR_CODES.METADATA_LOCKED);
      return true;
    },
  );
});

test("same seller/payer CNPJ throws SELLER_PAYER_MUST_DIFFER", () => {
  assert.throws(
    () => assertSellerPayerCnpjDiffer("12.345.678/0001-95", "12345678000195"),
    (e: unknown) => {
      assert.ok(e instanceof ReceivableError);
      assert.equal(e.code, RECEIVABLE_ERROR_CODES.SELLER_PAYER_MUST_DIFFER);
      return true;
    },
  );
});

test("assertSellerOwnsReceivable throws NOT_OWNER", () => {
  assert.throws(
    () => assertSellerOwnsReceivable({ profileId: "a" }, { sellerId: "b" }),
    (e: unknown) => {
      assert.ok(e instanceof ReceivableError);
      assert.equal(e.code, RECEIVABLE_ERROR_CODES.NOT_OWNER);
      return true;
    },
  );
});
