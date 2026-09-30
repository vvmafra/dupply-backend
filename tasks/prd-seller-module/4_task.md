# Task 4.0: Metadata update + submit-for-review commands

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implements two application commands: `executeUpdateSellerMetadata` (partial PATCH of the three JSON metadata sections while the seller is still in `created` status) and `executeSubmitSellerForReview` (validate completeness and transition to `in_review`, locking the profile from further edits). Both commands consume the domain validators and policies from task 2.

Corresponds to **techspec component 5**.

Depends on: _1.0, 2.0_

## Requirements

- `executeUpdateSellerMetadata`: loads seller, calls `assertCanUpdateSellerMetadata` (own seller, status `created`), deep-merges the provided partial sections into existing JSON, validates only touched fields (partial validation — not full completeness), applies `toCents` to `shareCapital` and `annualRevenue` before persisting, bumps `updatedAt` (FR-3, FR-5)
- `executeSubmitSellerForReview`: loads seller, calls `assertCanSubmitForReview`, parses all three JSON blobs, calls `assertCompleteSellerMetadata` (full validation), calls `assertSellerStatusTransition(created → in_review)`, updates `status = "in_review"` and `updatedAt` (FR-10)
- PATCH of metadata after `in_review`/`active`/`inactive` → `409 metadata_locked` (FR-3)
- Submit with missing required fields → `400 incomplete_metadata` (FR-10)
- Submit when status is not `created` → `409 invalid_status_for_submit` (FR-10)
- Returns updated `SellerPublicView` from update command (money fields converted back to reais via `toReais`)

## Subtasks

- [ ] 4.1 Read existing application command files to understand the `loadSellerOrThrow` pattern and `AppDeps` shape
- [ ] 4.2 Create helper `loadSellerOrThrow(deps, sellerId)` — shared by all seller commands (put in `src/application/seller/sellerHelpers.ts` or inline if pattern already exists)
- [ ] 4.3 Create `src/application/seller/commands/updateSellerMetadataCommand.ts`
- [ ] 4.4 Create `src/application/seller/commands/submitSellerForReviewCommand.ts`
- [ ] 4.5 Write unit tests `tests/application/seller/updateSellerMetadataCommand.test.ts` covering: status `created` → succeeds, status `in_review` → 409, partial merge preserves untouched fields, money conversion
- [ ] 4.6 Write unit tests `tests/application/seller/submitSellerForReviewCommand.test.ts` covering: incomplete metadata → 400, complete metadata → status `in_review`, not-owner → 403
- [ ] 4.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "5. Application — metadata update and submit"**.

### Update command flow

```
load seller → assertCanUpdateSellerMetadata(actor, seller)
→ parse existing JSON blobs
→ deep-merge with input partials
→ validate only touched fields (not full assertCompleteSellerMetadata)
→ toCents(companyMetaData.shareCapital), toCents(companyMetaData.annualRevenue)
→ UPDATE sellers SET company_meta_data = ..., updated_at = NOW()
→ re-parse stored data, toReais on money fields
→ return SellerPublicView
```

Input type:

```typescript
export type UpdateSellerMetadataInput = {
  name?: string;
  companyMetaData?: Partial<CompanyMetaData>;        // shareCapital / annualRevenue in reais
  legalRepresentativeMetaData?: Partial<LegalRepresentativeMetaData>;
  businessRelationsMetaData?: Partial<BusinessRelationsMetaData>;
};
```

### Submit command flow

```
load seller → assertCanSubmitForReview(actor, seller)
→ parseJson<CompanyMetaData>(seller.companyMetaData)
→ parseJson<LegalRepresentativeMetaData>(...)
→ parseJson<BusinessRelationsMetaData>(...)
→ assertCompleteSellerMetadata(company, legal, relations)   // throws incomplete_metadata if any required field missing
→ assertSellerStatusTransition(seller.status, "in_review", { kind: "seller", accountId: seller.accountId })
→ UPDATE sellers SET status = 'in_review', updated_at = NOW()
```

Document upload is **not** validated in v1 submit — out of scope.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] PATCH while `status = created` persists merged JSON and returns `SellerPublicView` with money in reais
- [ ] PATCH while `status = in_review` returns `409 metadata_locked`
- [ ] PATCH by a different seller (wrong `profileId`) returns `403 forbidden`
- [ ] Submit with all required fields filled transitions status to `in_review`
- [ ] Submit with missing required field returns `400 incomplete_metadata`
- [ ] Submit when status is already `in_review` returns `409 invalid_status_for_submit`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-seller-module/prd.md` ← read first
- `tasks/prd-seller-module/techspec.md` ← read first
- `src/application/seller/commands/updateSellerMetadataCommand.ts` ← create
- `src/application/seller/commands/submitSellerForReviewCommand.ts` ← create
- `src/application/seller/sellerHelpers.ts` ← create (shared `loadSellerOrThrow`)
- `tests/application/seller/updateSellerMetadataCommand.test.ts` ← create
- `tests/application/seller/submitSellerForReviewCommand.test.ts` ← create
