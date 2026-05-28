# Task 3.0: Application duplicate guard (assertNoActiveReceivableDuplicate)

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implements the primary application-layer duplicate check: query for an existing non-deleted, active-status receivable for the same seller matching either materialized business key, exclude the current receivable on update/submit, and throw granular `ReceivableError` codes. Includes `isReceivableUniqueViolation` to map DB constraint failures to the same error codes as a concurrency backstop.

Corresponds to **techspec § Component 3 — Application duplicate guard**.

Depends on: **1.0**, **2.0**

## Requirements

- FR-2: Check another receivable for same seller, same normalized key, active status, `deletedAt IS NULL`
- FR-8: `excludeReceivableId` excludes the receivable being edited from the collision set
- FR-10: No cross-seller matching — query always filters by `sellerId`
- OQ-6: No-op when both `normalizedBillNumber` and `normalizedFiscalDocumentKey` are null
- Throw `DUPLICATE_BILL_NUMBER` when bill dimension collides; otherwise `DUPLICATE_FISCAL_KEY`
- `isReceivableUniqueViolation` recognizes index names `receivables_seller_bill_active_unique` and `receivables_seller_fiscal_key_active_unique`

## Subtasks

- [ ] 3.1 Read `src/application/wallet/commands/registerSellerWalletCommand.ts` (or equivalent) for the dual-layer guard pattern
- [ ] 3.2 Create `src/application/receivable/duplicateGuard.ts` with `assertNoActiveReceivableDuplicate` and `isReceivableUniqueViolation`
- [ ] 3.3 Write unit tests in `tests/application/receivable/duplicateGuard.test.ts` per techspec test table
- [ ] 3.4 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "3. Application duplicate guard"**.

Query uses `inArray(receivables.status, DUPLICATE_BLOCKING_STATUSES)`, `isNull(receivables.deletedAt)`, and `or()` on materialized key equality. Single-row `LIMIT 1` lookup.

Mirror wallet pattern: application check is primary; DB unique violation is backstop only.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Both keys null → no throw
- [ ] Active collision on bill number → `duplicate_bill_number`
- [ ] Prior receivable in `reproved` status → no throw
- [ ] `excludeReceivableId` matching self → no throw
- [ ] Same bill for different seller → no throw
- [ ] Soft-deleted collision row → no throw
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-duplicate-guard/prd.md` ← read first
- `tasks/prd-receivable-duplicate-guard/techspec.md` ← read first
- `src/application/receivable/duplicateGuard.ts` ← create
- `src/domain/receivable/businessKey.ts` ← read
- `src/domain/receivable/errors.ts` ← read
- `src/db/schema.runtime.js` or `schema.runtime.ts` ← read (`receivables` table)
- `tests/application/receivable/duplicateGuard.test.ts` ← create
