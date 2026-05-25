import type { AccountRole } from "../account/types.js";
import type { SellerStatus } from "../seller/types.js";
import { WALLET_ERROR_CODES, WalletError } from "./errors.js";
import type { WalletNetwork } from "./types.js";

export function assertCanRegisterSellerWallet(
  actor: { profileId: string; role: AccountRole },
  seller: { id: string; status: SellerStatus; walletId: string | null; deletedAt: Date | null },
  _network: WalletNetwork,
): void {
  if (seller.deletedAt !== null) {
    throw new WalletError(WALLET_ERROR_CODES.SELLER_NOT_FOUND);
  }
  if (actor.profileId !== seller.id) {
    throw new WalletError(WALLET_ERROR_CODES.FORBIDDEN);
  }
  if (seller.status !== "active") {
    throw new WalletError(WALLET_ERROR_CODES.SELLER_NOT_ACTIVE);
  }
  if (seller.walletId !== null) {
    throw new WalletError(WALLET_ERROR_CODES.WALLET_ALREADY_EXISTS);
  }
}

export function assertCanReadWallet(
  actor: { profileId: string; role: AccountRole },
  wallet: { id: string; sellerId: string | null; parentType: string },
): void {
  if (actor.role === "admin") return;
  if (wallet.parentType === "seller" && wallet.sellerId === actor.profileId) return;
  throw new WalletError(WALLET_ERROR_CODES.FORBIDDEN);
}

export function assertCanUpdateWalletStatus(actor: { role: AccountRole }): void {
  if (actor.role !== "admin") {
    throw new WalletError(WALLET_ERROR_CODES.FORBIDDEN);
  }
}
