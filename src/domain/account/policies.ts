import {
  ACCOUNT_ERROR_CODES,
  AUTH_ERROR_CODES,
  AccountError,
  AuthError,
} from "./errors.js";
import type { AccountAuthSnapshot, AccountRole } from "./types.js";

export function requireLoginCandidate(
  account: AccountAuthSnapshot | undefined,
): AccountAuthSnapshot {
  if (!account) {
    throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  }
  return account;
}

export function assertCanAuthenticate(account: AccountAuthSnapshot): void {
  if (account.deletedAt !== null) {
    throw new AuthError(AUTH_ERROR_CODES.ACCOUNT_DELETED);
  }
  if (account.status !== "active") {
    throw new AuthError(AUTH_ERROR_CODES.ACCOUNT_INACTIVE);
  }
}

export function assertCanReadAccount(
  actor: { sub: string; role: AccountRole },
  accountId: string,
): void {
  if (actor.sub === accountId || actor.role === "admin") return;
  throw new AccountError(ACCOUNT_ERROR_CODES.FORBIDDEN);
}

export function assertCanMutateAccount(
  actor: { sub: string; role: AccountRole },
  accountId: string,
): void {
  assertCanReadAccount(actor, accountId);
}

export function assertCanSoftDeleteAccount(actor: { role: AccountRole }): void {
  if (actor.role !== "admin") {
    throw new AccountError(ACCOUNT_ERROR_CODES.FORBIDDEN);
  }
}
