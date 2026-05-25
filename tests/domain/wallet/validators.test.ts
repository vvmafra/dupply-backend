import assert from "node:assert/strict";
import test from "node:test";

import { WALLET_ERROR_CODES, WalletError } from "../../../src/domain/wallet/errors.js";
import {
  assertValidSellerSmartAccountWallet,
  type RegisterSellerWalletPayload,
} from "../../../src/domain/wallet/validators.js";

const VALID_CONTRACT_ID =
  "CABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
const VALID_SIGNER_KEY = "04" + "a".repeat(128);

const validPayload: RegisterSellerWalletPayload = {
  contractId: VALID_CONTRACT_ID,
  credentialId: "cred-base64url-id",
  signerPublicKey: VALID_SIGNER_KEY,
  network: "testnet",
};

test("assertValidSellerSmartAccountWallet accepts valid Soroban address", () => {
  assert.doesNotThrow(() => assertValidSellerSmartAccountWallet(validPayload));
});

test("assertValidSellerSmartAccountWallet rejects G... address", () => {
  assert.throws(
    () =>
      assertValidSellerSmartAccountWallet({
        ...validPayload,
        contractId: "GA7QYNF7SOWQYL5J2F7J2G3V4R5N6M7L8K9J0H1I2J3K4L5M6N7O8P",
      }),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.VALIDATION_ERROR);
      return true;
    },
  );
});

test("assertValidSellerSmartAccountWallet rejects short contractId", () => {
  assert.throws(
    () =>
      assertValidSellerSmartAccountWallet({
        ...validPayload,
        contractId: "CABC",
      }),
    WalletError,
  );
});

test("assertValidSellerSmartAccountWallet accepts valid signer hex", () => {
  assert.doesNotThrow(() =>
    assertValidSellerSmartAccountWallet({
      ...validPayload,
      signerPublicKey: "a".repeat(130),
    }),
  );
});

test("assertValidSellerSmartAccountWallet rejects invalid signer hex", () => {
  assert.throws(
    () =>
      assertValidSellerSmartAccountWallet({
        ...validPayload,
        signerPublicKey: "not-hex",
      }),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.VALIDATION_ERROR);
      return true;
    },
  );
});

test("assertValidSellerSmartAccountWallet rejects empty credentialId", () => {
  assert.throws(
    () =>
      assertValidSellerSmartAccountWallet({
        ...validPayload,
        credentialId: "",
      }),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.VALIDATION_ERROR);
      return true;
    },
  );
});

test("assertValidSellerSmartAccountWallet rejects invalid network", () => {
  assert.throws(
    () =>
      assertValidSellerSmartAccountWallet({
        ...validPayload,
        network: "devnet" as "testnet",
      }),
    (e: unknown) => {
      assert.ok(e instanceof WalletError);
      assert.equal(e.code, WALLET_ERROR_CODES.VALIDATION_ERROR);
      return true;
    },
  );
});
