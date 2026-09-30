import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { wallets } from "../../../../infra/database/schema.runtime.js";
import type { AccountRole } from "../../../account/domain/types.js";
import { assertCanUpdateWalletStatus } from "../../domain/policies.js";
import type { WalletPublicView, WalletStatus } from "../../domain/types.js";
import { WALLET_ERROR_CODES, WalletError } from "../../domain/errors.js";
import { isWalletUniqueViolation, loadWalletOrThrow, toWalletPublicView } from "../walletHelpers.js";

export type UpdateWalletStatusInput = {
  walletId: string;
  status: WalletStatus;
  actor: { role: AccountRole };
};

export async function executeUpdateWalletStatus(
  deps: AppDeps,
  input: UpdateWalletStatusInput,
): Promise<WalletPublicView> {
  assertCanUpdateWalletStatus(input.actor);
  const wallet = await loadWalletOrThrow(deps, input.walletId);
  const now = new Date();

  try {
    await deps.db
      .update(wallets)
      .set({ status: input.status, updatedAt: now })
      .where(eq(wallets.id, input.walletId));
  } catch (error) {
    if (isWalletUniqueViolation(error)) {
      throw new WalletError(WALLET_ERROR_CODES.WALLET_ALREADY_EXISTS);
    }
    throw error;
  }

  return toWalletPublicView({ ...wallet, status: input.status, updatedAt: now });
}
