import type { AppDeps } from "../../../../compose/deps.js";
import type { AccountRole } from "../../../account/domain/types.js";
import { assertCanReadSeller } from "../../domain/policies.js";
import type { SellerPublicView } from "../../domain/types.js";
import { loadSellerOrThrow, mapSellerRowToPublicView } from "../sellerHelpers.js";

export type GetSellerInput = {
  actor: { sub: string; role: AccountRole; profileId: string };
  sellerId: string;
};

export async function executeGetSeller(
  deps: AppDeps,
  input: GetSellerInput,
): Promise<SellerPublicView> {
  const seller = await loadSellerOrThrow(deps, input.sellerId);
  assertCanReadSeller(input.actor, {
    id: seller.id,
    accountId: seller.accountId,
    status: seller.status as SellerPublicView["status"],
    deletedAt: seller.deletedAt,
  });
  return mapSellerRowToPublicView(seller);
}
