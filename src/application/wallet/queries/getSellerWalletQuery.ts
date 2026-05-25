import type { AppDeps } from "../../deps.js";
import type { AccountRole } from "../../../domain/account/types.js";
import { assertCanReadSeller } from "../../../domain/seller/policies.js";
import type { SellerStatus } from "../../../domain/seller/types.js";
import { assertCanReadWallet } from "../../../domain/wallet/policies.js";
import { WALLET_ERROR_CODES, WalletError } from "../../../domain/wallet/errors.js";
import type { WalletPublicView } from "../../../domain/wallet/types.js";
import { loadSellerOrThrow } from "../../seller/sellerHelpers.js";
import { loadWalletOrThrow, toWalletPublicView } from "../walletHelpers.js";

export type GetSellerWalletInput = {
  actor: { sub: string; role: AccountRole; profileId: string };
  sellerId: string;
};

export async function executeGetSellerWallet(
  deps: AppDeps,
  input: GetSellerWalletInput,
): Promise<WalletPublicView> {
  const seller = await loadSellerOrThrow(deps, input.sellerId);
  assertCanReadSeller(input.actor, {
    id: seller.id,
    accountId: seller.accountId,
    status: seller.status as SellerStatus,
    deletedAt: seller.deletedAt,
  });

  if (seller.walletId === null) {
    throw new WalletError(WALLET_ERROR_CODES.NOT_FOUND);
  }

  const wallet = await loadWalletOrThrow(deps, seller.walletId);
  assertCanReadWallet(input.actor, wallet);
  return toWalletPublicView(wallet);
}
