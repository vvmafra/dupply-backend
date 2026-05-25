import assert from "node:assert/strict";
import test from "node:test";

import { WALLET_ERROR_CODES, WalletError } from "../../../src/domain/wallet/errors.js";
import {
  assertCanReadWallet,
  assertCanRegisterSellerWallet,
  assertCanUpdateWalletStatus,
} from "../../../src/domain/wallet/policies.js";

const baseSeller = {
  id: "seller-1",
  status: "active" as const,
  walletId: null as string | null,
  deletedAt: null as Date | null,
};

const baseWallet = {
  id: "wallet-1",
  sellerId: "seller-1",
  parentType: "seller",
};

test("assertCanRegisterSellerWallet allows own active seller with walletId null", () => {
  assert.doesNotThrow(() =>
    assertCanRegisterSellerWallet(
      { profileId: "seller-1", role: "seller" },
      baseSeller,
      "testnet",
    ),
  );
});

test("assertCanRegisterSellerWallet rejects other seller", () => {
  assert.throws(
    () =>
      assertCanRegisterSellerWallet(
        { profileId: "seller-2", role: "seller" },
        baseSeller,
        "testnet",
      ),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.FORBIDDEN);
      return true;
    },
  );
});

test("assertCanRegisterSellerWallet rejects inactive seller", () => {
  assert.throws(
    () =>
      assertCanRegisterSellerWallet(
        { profileId: "seller-1", role: "seller" },
        { ...baseSeller, status: "in_review" },
        "testnet",
      ),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.SELLER_NOT_ACTIVE);
      return true;
    },
  );
});

test("assertCanRegisterSellerWallet rejects when walletId already set", () => {
  assert.throws(
    () =>
      assertCanRegisterSellerWallet(
        { profileId: "seller-1", role: "seller" },
        { ...baseSeller, walletId: "wallet-existing" },
        "testnet",
      ),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.WALLET_ALREADY_EXISTS);
      return true;
    },
  );
});

test("assertCanRegisterSellerWallet rejects soft-deleted seller", () => {
  assert.throws(
    () =>
      assertCanRegisterSellerWallet(
        { profileId: "seller-1", role: "seller" },
        { ...baseSeller, deletedAt: new Date() },
        "testnet",
      ),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.SELLER_NOT_FOUND);
      return true;
    },
  );
});

test("assertCanReadWallet allows seller to read own wallet", () => {
  assert.doesNotThrow(() =>
    assertCanReadWallet(
      { profileId: "seller-1", role: "seller" },
      baseWallet,
    ),
  );
});

test("assertCanReadWallet rejects seller reading other wallet", () => {
  assert.throws(
    () =>
      assertCanReadWallet(
        { profileId: "seller-2", role: "seller" },
        baseWallet,
      ),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.FORBIDDEN);
      return true;
    },
  );
});

test("assertCanReadWallet allows admin to read any wallet", () => {
  assert.doesNotThrow(() =>
    assertCanReadWallet(
      { profileId: "admin-placeholder", role: "admin" },
      baseWallet,
    ),
  );
});

test("assertCanUpdateWalletStatus allows admin", () => {
  assert.doesNotThrow(() => assertCanUpdateWalletStatus({ role: "admin" }));
});

test("assertCanUpdateWalletStatus rejects seller", () => {
  assert.throws(
    () => assertCanUpdateWalletStatus({ role: "seller" }),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.FORBIDDEN);
      return true;
    },
  );
});
