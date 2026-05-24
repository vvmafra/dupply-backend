import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { accounts } from "../../../db/schema.runtime.js";
import { AUTH_ERROR_CODES, AuthError } from "../../../domain/account/errors.js";
import type { AccountAuthSnapshot, AccountRole, AccountStatus } from "../../../domain/account/types.js";
import {
  parseStoredRefreshToken,
  refreshTokenLookupKey,
  serializeStoredRefreshToken,
  type StoredRefreshToken,
  verifyStoredRefreshToken,
} from "../../../lib/refreshToken.js";

function toAuthSnapshot(row: typeof accounts.$inferSelect): AccountAuthSnapshot {
  return {
    id: row.id,
    email: row.email,
    role: row.role as AccountRole,
    status: row.status as AccountStatus,
    passwordHash: row.passwordHash,
    refreshToken: row.refreshToken,
    deletedAt: row.deletedAt,
  };
}

export async function findAccountByEmail(
  deps: AppDeps,
  email: string,
): Promise<AccountAuthSnapshot | undefined> {
  const [row] = await deps.db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);
  return row ? toAuthSnapshot(row) : undefined;
}

export async function findAccountByRefreshToken(
  deps: AppDeps,
  plainRefreshToken: string,
): Promise<AccountAuthSnapshot> {
  const lookup = refreshTokenLookupKey(plainRefreshToken);
  const [row] = await deps.db
    .select()
    .from(accounts)
    .where(and(eq(accounts.refreshTokenLookup, lookup), isNull(accounts.deletedAt)))
    .limit(1);

  if (!row?.refreshToken) {
    throw new AuthError(AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
  }

  const stored = parseStoredRefreshToken(row.refreshToken);
  if (!stored) {
    throw new AuthError(AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
  }

  await verifyStoredRefreshToken(
    plainRefreshToken,
    stored,
    deps.config.JWT_REFRESH_TTL_SECONDS,
  );

  return toAuthSnapshot(row);
}

export async function persistRefreshToken(
  deps: AppDeps,
  accountId: string,
  plainRefreshToken: string,
  stored: StoredRefreshToken,
): Promise<void> {
  await deps.db
    .update(accounts)
    .set({
      refreshToken: serializeStoredRefreshToken(stored),
      refreshTokenLookup: refreshTokenLookupKey(plainRefreshToken),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));
}
