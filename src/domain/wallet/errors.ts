export const WALLET_ERROR_CODES = {
  NOT_FOUND: "wallet_not_found",
  SELLER_NOT_FOUND: "seller_not_found",
  FORBIDDEN: "forbidden",
  SELLER_NOT_ACTIVE: "seller_not_active",
  WALLET_ALREADY_EXISTS: "wallet_already_exists",
  VALIDATION_ERROR: "validation_error",
  INVALID_WALLET_STATUS: "invalid_wallet_status",
} as const;

export type WalletErrorCode = (typeof WALLET_ERROR_CODES)[keyof typeof WALLET_ERROR_CODES];

export class WalletError extends Error {
  constructor(readonly code: WalletErrorCode) {
    super(code);
    this.name = "WalletError";
  }
}
