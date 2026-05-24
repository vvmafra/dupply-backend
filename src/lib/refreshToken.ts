import { createHash, randomBytes } from "node:crypto";

import argon2 from "argon2";

import { AUTH_ERROR_CODES, AuthError } from "../domain/account/errors.js";

export type StoredRefreshToken = {
  hash: string;
  issuedAtMs: number;
};

export function refreshTokenLookupKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export async function issueRefreshToken(): Promise<{
  plain: string;
  stored: StoredRefreshToken;
}> {
  const plain = randomBytes(32).toString("base64url");
  const hash = await argon2.hash(plain);
  return { plain, stored: { hash, issuedAtMs: Date.now() } };
}

export function serializeStoredRefreshToken(stored: StoredRefreshToken): string {
  return JSON.stringify(stored);
}

export function parseStoredRefreshToken(raw: string | null): StoredRefreshToken | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredRefreshToken;
    if (typeof parsed.hash === "string" && typeof parsed.issuedAtMs === "number") {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function isRefreshTokenExpired(
  stored: StoredRefreshToken,
  ttlSeconds: number,
  nowMs = Date.now(),
): boolean {
  return nowMs - stored.issuedAtMs > ttlSeconds * 1000;
}

export async function verifyStoredRefreshToken(
  plain: string,
  stored: StoredRefreshToken,
  ttlSeconds: number,
  nowMs = Date.now(),
): Promise<void> {
  if (isRefreshTokenExpired(stored, ttlSeconds, nowMs)) {
    throw new AuthError(AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED);
  }
  const valid = await argon2.verify(stored.hash, plain);
  if (!valid) {
    throw new AuthError(AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
  }
}
