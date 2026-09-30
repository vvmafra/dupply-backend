export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: "invalid_credentials",
  ACCOUNT_INACTIVE: "account_inactive",
  ACCOUNT_DELETED: "account_deleted",
  INVALID_REFRESH_TOKEN: "invalid_refresh_token",
  REFRESH_TOKEN_EXPIRED: "refresh_token_expired",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

export const ACCOUNT_ERROR_CODES = {
  NOT_FOUND: "account_not_found",
  FORBIDDEN: "forbidden",
} as const;

export type AccountErrorCode =
  (typeof ACCOUNT_ERROR_CODES)[keyof typeof ACCOUNT_ERROR_CODES];

export class AccountError extends Error {
  constructor(readonly code: AccountErrorCode) {
    super(code);
    this.name = "AccountError";
  }
}
