import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../deps.js";
import { wallets } from "../../db/schema.runtime.js";
import { WALLET_ERROR_CODES, WalletError } from "../../domain/wallet/errors.js";
import type { WalletPublicView, WalletStatus } from "../../domain/wallet/types.js";

export type WalletRow = typeof wallets.$inferSelect;

export async function loadWalletOrThrow(deps: AppDeps, walletId: string): Promise<WalletRow> {
  const [row] = await deps.db
    .select()
    .from(wallets)
    .where(and(eq(wallets.id, walletId), isNull(wallets.deletedAt)))
    .limit(1);
  if (!row) {
    throw new WalletError(WALLET_ERROR_CODES.NOT_FOUND);
  }
  return row;
}

export function toWalletPublicView(row: {
  id: string;
  status: string;
  network: string;
  address: string;
  type: string;
  credentialId: string | null;
  signerPublicKey: string;
  createdTxHash: string | null;
  parentType: string;
  sellerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WalletPublicView {
  return {
    id: row.id,
    status: row.status as WalletStatus,
    network: row.network as WalletPublicView["network"],
    address: row.address,
    type: "smart_account",
    credentialId: row.credentialId ?? "",
    signerPublicKey: row.signerPublicKey,
    createdTxHash: row.createdTxHash,
    parentType: "seller",
    sellerId: row.sellerId ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function isWalletUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("unique") || msg.includes("constraint");
}
