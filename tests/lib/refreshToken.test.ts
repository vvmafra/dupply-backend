import assert from "node:assert/strict";
import test from "node:test";

import { AUTH_ERROR_CODES, AuthError } from "../../src/domain/account/errors.js";
import {
  isRefreshTokenExpired,
  issueRefreshToken,
  parseStoredRefreshToken,
  serializeStoredRefreshToken,
  verifyStoredRefreshToken,
} from "../../src/lib/refreshToken.js";

const REFRESH_TTL_SECONDS = 604_800;

test("issueRefreshToken + verifyStoredRefreshToken round-trip succeeds", async () => {
  const { plain, stored } = await issueRefreshToken();
  await assert.doesNotReject(() =>
    verifyStoredRefreshToken(plain, stored, REFRESH_TTL_SECONDS),
  );
});

test("verifyStoredRefreshToken rejects wrong plain token", async () => {
  const { stored } = await issueRefreshToken();
  await assert.rejects(
    () => verifyStoredRefreshToken("wrong-token", stored, REFRESH_TTL_SECONDS),
    (e: unknown) => {
      assert.ok(e instanceof AuthError);
      assert.equal(e.code, AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
      return true;
    },
  );
});

test("isRefreshTokenExpired detects token beyond TTL", () => {
  const stored = {
    hash: "hash",
    issuedAtMs: Date.now() - (REFRESH_TTL_SECONDS + 1) * 1000,
  };
  assert.equal(isRefreshTokenExpired(stored, REFRESH_TTL_SECONDS), true);
});

test("verifyStoredRefreshToken rejects expired token", async () => {
  const { plain, stored } = await issueRefreshToken();
  const expiredStored = {
    ...stored,
    issuedAtMs: Date.now() - (REFRESH_TTL_SECONDS + 1) * 1000,
  };
  await assert.rejects(
    () => verifyStoredRefreshToken(plain, expiredStored, REFRESH_TTL_SECONDS),
    (e: unknown) => {
      assert.ok(e instanceof AuthError);
      assert.equal(e.code, AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED);
      return true;
    },
  );
});

test("serializeStoredRefreshToken and parseStoredRefreshToken round-trip", async () => {
  const { stored } = await issueRefreshToken();
  const raw = serializeStoredRefreshToken(stored);
  const parsed = parseStoredRefreshToken(raw);
  assert.deepEqual(parsed, stored);
});

test("parseStoredRefreshToken returns null for invalid JSON", () => {
  assert.equal(parseStoredRefreshToken("{not-json"), null);
});

test("parseStoredRefreshToken returns null for malformed payload", () => {
  assert.equal(parseStoredRefreshToken(JSON.stringify({ hash: "only-hash" })), null);
});

test("parseStoredRefreshToken returns null for null input", () => {
  assert.equal(parseStoredRefreshToken(null), null);
});
