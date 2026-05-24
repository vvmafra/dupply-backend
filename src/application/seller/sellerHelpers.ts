import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../deps.js";
import { sellers } from "../../db/schema.runtime.js";
import { SELLER_ERROR_CODES, SellerError } from "../../domain/seller/errors.js";
import type {
  BusinessRelationsMetaData,
  CompanyMetaData,
  LegalRepresentativeMetaData,
  SellerPublicView,
  SellerStatus,
} from "../../domain/seller/types.js";
import { toReais } from "../../shared/money.js";

export type SellerRow = typeof sellers.$inferSelect;

export async function loadSellerOrThrow(deps: AppDeps, sellerId: string): Promise<SellerRow> {
  const [row] = await deps.db
    .select()
    .from(sellers)
    .where(and(eq(sellers.id, sellerId), isNull(sellers.deletedAt)))
    .limit(1);
  if (!row) {
    throw new SellerError(SELLER_ERROR_CODES.NOT_FOUND);
  }
  return row;
}

export function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

export function mapSellerRowToPublicView(row: SellerRow): SellerPublicView {
  const company = parseJson<CompanyMetaData>(row.companyMetaData);
  const legal = parseJson<LegalRepresentativeMetaData>(row.legalRepresentativeMetaData);
  const relations = parseJson<BusinessRelationsMetaData>(row.businessRelationsMetaData);

  if (company.shareCapital != null) {
    company.shareCapital = toReais(company.shareCapital);
  }
  if (company.annualRevenue != null) {
    company.annualRevenue = toReais(company.annualRevenue);
  }

  return {
    id: row.id,
    status: row.status as SellerStatus,
    name: row.name,
    companyMetaData: company,
    legalRepresentativeMetaData: legal,
    businessRelationsMetaData: relations,
    accountId: row.accountId,
    walletId: row.walletId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
