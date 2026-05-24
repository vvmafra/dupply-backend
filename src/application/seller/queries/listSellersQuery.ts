import { and, desc, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { sellers } from "../../../db/schema.runtime.js";
import type { AccountRole } from "../../../domain/account/types.js";
import { SELLER_ERROR_CODES, SellerError } from "../../../domain/seller/errors.js";
import type { SellerPublicView, SellerStatus } from "../../../domain/seller/types.js";
import { mapSellerRowToPublicView } from "../sellerHelpers.js";

export type ListSellersInput = {
  actor: { role: AccountRole };
  status?: SellerStatus;
};

export async function executeListSellers(
  deps: AppDeps,
  input: ListSellersInput,
): Promise<SellerPublicView[]> {
  let statusFilter = input.status;

  if (input.actor.role === "risk_analyst") {
    statusFilter = "in_review";
  } else if (input.actor.role !== "admin") {
    throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
  }

  const conditions = [isNull(sellers.deletedAt)];
  if (statusFilter) {
    conditions.push(eq(sellers.status, statusFilter));
  }

  const rows = await deps.db
    .select()
    .from(sellers)
    .where(and(...conditions))
    .orderBy(desc(sellers.updatedAt));

  return rows.map(mapSellerRowToPublicView);
}
