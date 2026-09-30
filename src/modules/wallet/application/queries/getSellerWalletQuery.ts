import type { AppDeps } from "../../../../compose/deps.js";
import type { AccountRole } from "../../../account/domain/types.js";
import { assertCanReadSeller } from "../../../seller/domain/policies.js";
import type { SellerStatus } from "../../../seller/domain/types.js";
import { assertCanReadWallet } from "../../domain/policies.js";
import { WALLET_ERROR_CODES, WalletError } from "../../domain/errors.js";
import type { WalletPublicView } from "../../domain/types.js";
import { loadSellerOrThrow } from "../../../seller/application/sellerHelpers.js";
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
