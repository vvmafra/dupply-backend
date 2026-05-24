import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { sellers } from "../../../db/schema.runtime.js";
import { assertCanSubmitForReview } from "../../../domain/seller/policies.js";
import { assertSellerStatusTransition } from "../../../domain/seller/transitions.js";
import type {
  BusinessRelationsMetaData,
  CompanyMetaData,
  LegalRepresentativeMetaData,
  SellerStatus,
} from "../../../domain/seller/types.js";
import { assertCompleteSellerMetadata } from "../../../domain/seller/validators.js";
import {
  loadSellerOrThrow,
  parseJson,
} from "../sellerHelpers.js";

export async function executeSubmitSellerForReview(
  deps: AppDeps,
  actor: { profileId: string },
  sellerId: string,
): Promise<void> {
  const seller = await loadSellerOrThrow(deps, sellerId);
  assertCanSubmitForReview(actor, {
    id: seller.id,
    status: seller.status as SellerStatus,
  });

  const company = parseJson<CompanyMetaData>(seller.companyMetaData);
  const legal = parseJson<LegalRepresentativeMetaData>(seller.legalRepresentativeMetaData);
  const relations = parseJson<BusinessRelationsMetaData>(seller.businessRelationsMetaData);

  assertCompleteSellerMetadata(company, legal, relations);
  assertSellerStatusTransition(seller.status as "created", "in_review", {
    kind: "seller",
    accountId: seller.accountId,
  });

  await deps.db
    .update(sellers)
    .set({ status: "in_review", updatedAt: new Date() })
    .where(eq(sellers.id, sellerId));
}
