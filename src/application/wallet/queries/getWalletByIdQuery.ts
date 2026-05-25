import type { AppDeps } from "../../deps.js";
import type { AccountRole } from "../../../domain/account/types.js";
import { assertCanReadWallet } from "../../../domain/wallet/policies.js";
import type { WalletPublicView } from "../../../domain/wallet/types.js";
import { loadWalletOrThrow, toWalletPublicView } from "../walletHelpers.js";

export type GetWalletByIdInput = {
  actor: { profileId: string; role: AccountRole };
  walletId: string;
};

export async function executeGetWalletById(
  deps: AppDeps,
  input: GetWalletByIdInput,
): Promise<WalletPublicView> {
  const wallet = await loadWalletOrThrow(deps, input.walletId);
  assertCanReadWallet(input.actor, wallet);
  return toWalletPublicView(wallet);
}
