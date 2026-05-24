import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { sellers } from "../../../db/schema.runtime.js";
import { assertCanUpdateSellerMetadata } from "../../../domain/seller/policies.js";
import type {
  BusinessRelationsMetaData,
  CompanyMetaData,
  LegalRepresentativeMetaData,
  SellerPublicView,
  SellerStatus,
} from "../../../domain/seller/types.js";
import {
  validatePartialBusinessRelationsMetaData,
  validatePartialCompanyMetaData,
  validatePartialLegalRepMetaData,
} from "../../../domain/seller/validators.js";
import { toCents } from "../../../shared/money.js";
import {
  loadSellerOrThrow,
  mapSellerRowToPublicView,
  parseJson,
} from "../sellerHelpers.js";

export type UpdateSellerMetadataInput = {
  name?: string;
  companyMetaData?: Partial<CompanyMetaData>;
  legalRepresentativeMetaData?: Partial<LegalRepresentativeMetaData>;
  businessRelationsMetaData?: Partial<BusinessRelationsMetaData>;
};

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    const existing = result[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key] = value as T[keyof T];
    }
  }
  return result;
}

export async function executeUpdateSellerMetadata(
  deps: AppDeps,
  actor: { profileId: string },
  sellerId: string,
  input: UpdateSellerMetadataInput,
): Promise<SellerPublicView> {
  const seller = await loadSellerOrThrow(deps, sellerId);
  assertCanUpdateSellerMetadata(actor, {
    id: seller.id,
    status: seller.status as SellerStatus,
  });

  const company = parseJson<CompanyMetaData>(seller.companyMetaData);
  const legal = parseJson<LegalRepresentativeMetaData>(seller.legalRepresentativeMetaData);
  const relations = parseJson<BusinessRelationsMetaData>(seller.businessRelationsMetaData);

  let mergedCompany = company;
  let mergedLegal = legal;
  let mergedRelations = relations;

  if (input.companyMetaData) {
    validatePartialCompanyMetaData(input.companyMetaData);
    mergedCompany = deepMerge(company, input.companyMetaData);
    if (input.companyMetaData.shareCapital !== undefined) {
      mergedCompany.shareCapital = toCents(input.companyMetaData.shareCapital);
    }
    if (input.companyMetaData.annualRevenue !== undefined) {
      mergedCompany.annualRevenue = toCents(input.companyMetaData.annualRevenue);
    }
  }

  if (input.legalRepresentativeMetaData) {
    validatePartialLegalRepMetaData(input.legalRepresentativeMetaData);
    mergedLegal = deepMerge(legal, input.legalRepresentativeMetaData);
  }

  if (input.businessRelationsMetaData) {
    validatePartialBusinessRelationsMetaData(input.businessRelationsMetaData);
    mergedRelations = deepMerge(relations, input.businessRelationsMetaData);
  }

  const now = new Date();
  await deps.db
    .update(sellers)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      companyMetaData: JSON.stringify(mergedCompany),
      legalRepresentativeMetaData: JSON.stringify(mergedLegal),
      businessRelationsMetaData: JSON.stringify(mergedRelations),
      updatedAt: now,
    })
    .where(eq(sellers.id, sellerId));

  const updated = await loadSellerOrThrow(deps, sellerId);
  return mapSellerRowToPublicView(updated);
}
