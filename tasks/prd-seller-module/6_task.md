# Task 6.0: Seller queries (get + list)

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implements the two read-side application queries: `executeGetSeller` (fetch a single seller by ID with authorization check) and `executeListSellers` (paginated/filtered list for admins and risk analysts). Both queries map raw DB rows to `SellerPublicView`, applying `toReais` on monetary fields so that money leaves the application layer in the correct API format. Soft-deleted sellers are excluded from all queries by default.

Corresponds to **techspec component 7**.

Depends on: _1.0, 2.0_

## Requirements

- `executeGetSeller`: fetches by `id`, calls `assertCanReadSeller(actor, seller)`, maps to `SellerPublicView` with `toReais` on `shareCapital` and `annualRevenue` (FR-16)
- `executeListSellers`: `role = admin` may list all sellers (filter by optional `?status`); `role = risk_analyst` is always coerced to `status = "in_review"` filter; other roles → `403 forbidden` (FR-16)
- All queries apply `WHERE deleted_at IS NULL` (OQ-4 decision — no trash view in v1)
- List ordered by `updated_at DESC`
- Seller not found or soft-deleted and not admin → `404 seller_not_found`

## Subtasks

- [ ] 6.1 Read existing query files to understand the mapping and `AppDeps` pattern
- [ ] 6.2 Create `src/application/seller/queries/getSellerQuery.ts` implementing `executeGetSeller`
- [ ] 6.3 Create `src/application/seller/queries/listSellersQuery.ts` implementing `executeListSellers`
- [ ] 6.4 Write unit tests `tests/application/seller/getSellerQuery.test.ts`: own seller reads own profile, admin reads any, risk_analyst reads in_review, risk_analyst blocked on active, soft-deleted → 404
- [ ] 6.5 Write unit tests `tests/application/seller/listSellersQuery.test.ts`: admin lists all, admin filters by status, risk_analyst gets in_review only, seller role → 403
- [ ] 6.6 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "7. Application — queries"**.

```typescript
// listSellersQuery.ts
export type ListSellersInput = {
  actor: { role: AccountRole };
  status?: SellerStatus;
};

export async function executeListSellers(
  deps: AppDeps,
  input: ListSellersInput,
): Promise<SellerPublicView[]> {
  if (input.actor.role === "risk_analyst") {
    input.status = "in_review"; // v1: coerce regardless of request filter
  } else if (input.actor.role !== "admin") {
    throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
  }
  // WHERE deleted_at IS NULL AND (status = :status if provided)
  // ORDER BY updated_at DESC
  // map rows → SellerPublicView with toReais()
}
```

**Money mapping in `SellerPublicView`:** parse stored JSON, apply `toReais(companyMetaData.shareCapital)` and `toReais(companyMetaData.annualRevenue)` before building the view object. Money fields inside `businessRelationsMetaData` do not exist — only `companyMetaData` carries monetary values.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] `executeGetSeller` returns `SellerPublicView` with money in reais
- [ ] Soft-deleted seller returns `404 seller_not_found` for a non-admin actor
- [ ] `risk_analyst` can get a seller in `in_review` status; blocked for `active` status (returns `403`)
- [ ] `executeListSellers` for `risk_analyst` always returns only `in_review` sellers regardless of `?status` param
- [ ] `executeListSellers` for `admin` with `?status=active` returns only active sellers
- [ ] Soft-deleted sellers never appear in list results
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-seller-module/prd.md` ← read first
- `tasks/prd-seller-module/techspec.md` ← read first
- `src/application/seller/queries/getSellerQuery.ts` ← create
- `src/application/seller/queries/listSellersQuery.ts` ← create
- `tests/application/seller/getSellerQuery.test.ts` ← create
- `tests/application/seller/listSellersQuery.test.ts` ← create
