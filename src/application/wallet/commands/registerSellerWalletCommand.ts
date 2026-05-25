import { createId } from "@paralleldrive/cuid2";
import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { sellers, wallets } from "../../../db/schema.runtime.js";
import type { AccountRole } from "../../../domain/account/types.js";
import { WALLET_ERROR_CODES, WalletError } from "../../../domain/wallet/errors.js";
import type { SellerStatus } from "../../../domain/seller/types.js";
import { assertCanRegisterSellerWallet } from "../../../domain/wallet/policies.js";
import type { WalletPublicView } from "../../../domain/wallet/types.js";
import {
  assertValidSellerSmartAccountWallet,
  type RegisterSellerWalletPayload,
} from "../../../domain/wallet/validators.js";
import { loadSellerOrThrow } from "../../seller/sellerHelpers.js";
import { toWalletPublicView } from "../walletHelpers.js";

export type RegisterSellerWalletInput = {
  actor: { profileId: string; role: AccountRole };
  sellerId: string;
  payload: RegisterSellerWalletPayload;
};

export async function executeRegisterSellerWallet(
  deps: AppDeps,
  input: RegisterSellerWalletInput,
): Promise<WalletPublicView> {
  const seller = await loadSellerOrThrow(deps, input.sellerId);
  assertCanRegisterSellerWallet(
    input.actor,
    {
      id: seller.id,
      status: seller.status as SellerStatus,
      walletId: seller.walletId,
      deletedAt: seller.deletedAt,
    },
    input.payload.network,
  );
  assertValidSellerSmartAccountWallet(input.payload);

  const [existing] = await deps.db
    .select()
    .from(wallets)
    .where(
      and(
        eq(wallets.sellerId, input.sellerId),
        eq(wallets.network, input.payload.network),
        eq(wallets.status, "active"),
        isNull(wallets.deletedAt),
      ),
    )
    .limit(1);
  if (existing) {
    throw new WalletError(WALLET_ERROR_CODES.WALLET_ALREADY_EXISTS);
  }

  const walletId = createId();
  const now = new Date();

  deps.db.transaction((tx) => {
    tx.insert(wallets)
      .values({
        id: walletId,
        status: "active",
        network: input.payload.network,
        address: input.payload.contractId,
        type: "smart_account",
        credentialId: input.payload.credentialId,
        secretEncrypted: null,
        signerPublicKey: input.payload.signerPublicKey,
        createdTxHash: input.payload.createdTxHash ?? null,
        parentType: "seller",
        sellerId: input.sellerId,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    tx.update(sellers)
      .set({ walletId, updatedAt: now })
      .where(eq(sellers.id, input.sellerId))
      .run();
  });

  return toWalletPublicView({
    id: walletId,
    status: "active",
    network: input.payload.network,
    address: input.payload.contractId,
    type: "smart_account",
    credentialId: input.payload.credentialId,
    signerPublicKey: input.payload.signerPublicKey,
    createdTxHash: input.payload.createdTxHash ?? null,
    parentType: "seller",
    sellerId: input.sellerId,
    createdAt: now,
    updatedAt: now,
  });
}
