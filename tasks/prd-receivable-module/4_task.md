# Task 4.0: Payer upsert port + draft commands (create + update)

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implement the payer upsert helper (preserve existing record on CNPJ collision — OQ-3) and the two draft lifecycle commands: create receivable (`status = created`) and update draft (PATCH while `status = created`). Delete references to legacy `sellerUserId`/`payerUserId` patterns.

Corresponds to **techspec § Components 7 and 8** (partial — create + update draft commands).

Depends on: **1.0**, **2.0**, **3.0**

## Requirements

- FR-1: Resolve `sellerId` from JWT `profileId`; upsert payer by `payerCnpj`; insert receivable with status `created`
- FR-2: Update draft only when `status = 'created'` — enforced via domain policy
- FR-13: Inactive seller (`seller.status !== 'active'`) throws `SellerError NOT_ACTIVE`
- FR-14: Seller and payer CNPJ must differ — enforced at create time
- FR-10: Create command calls `assertReceivableTransition` before insert
- Techspec: upsert on POST (PRD wins over `module-receivables.mdc` submit-only mention)
- Techspec: preserve existing payer `legalName`/`email` on CNPJ collision — no overwrite
- Techspec: `payerLegalName` and `payerFinancialEmail` required when payer CNPJ is new (NOT NULL columns)
- Unit/integration tests for create and update draft commands

## Subtasks

- [ ] 4.1 Read existing seller commands for `assertSellerCanCreateReceivable` / active seller pattern
- [ ] 4.2 Create `src/application/payer/commands/upsertPayerByCnpj.ts` with OQ-3 preserve-existing behavior
- [ ] 4.3 Create `src/application/receivable/commands/createReceivableCommand.ts` (`executeCreateReceivable`)
- [ ] 4.4 Create `src/application/receivable/commands/updateReceivableDraftCommand.ts` (`executeUpdateReceivableDraft`)
- [ ] 4.5 Write unit tests `tests/application/payer/upsertPayerByCnpj.test.ts`
- [ ] 4.6 Write unit tests `tests/application/receivable/createReceivableCommand.test.ts` and `updateReceivableDraftCommand.test.ts`
- [ ] 4.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "7. Payer upsert port"** and **§ "8. Application commands"** (create + update rows).

Create command input shape:

```typescript
export type CreateReceivableInput = {
  profileId: string;
  payerCnpj: string;
  payerLegalName?: string;
  payerFinancialEmail?: string;
  value?: string;
  receivableMetaData?: Partial<ReceivableMetaData>;
};
```

Create flow:
1. Load seller by `profileId`; assert active
2. Parse seller CNPJ from `companyMetaData`
3. `assertSellerPayerCnpjDiffer(sellerCnpj, payerCnpj)`
4. `upsertPayerByCnpj`
5. `assertReceivableTransition(/* implicit */ → created, { kind: "user", role: "seller" })`
6. INSERT with `createId()`

Update draft merges partial `receivableMetaData` JSON and optional `value`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Active seller creates draft → status `created`, `sellerId` and `payerId` populated
- [ ] Inactive seller create → `SellerError NOT_ACTIVE`
- [ ] Same seller/payer CNPJ → `SELLER_PAYER_MUST_DIFFER`
- [ ] Existing payer CNPJ reused without overwriting `legalName`/`email`
- [ ] Update on non-`created` status → `METADATA_LOCKED`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-module/prd.md` ← read first
- `tasks/prd-receivable-module/techspec.md` ← read first
- `src/application/payer/commands/upsertPayerByCnpj.ts` ← create
- `src/application/receivable/commands/createReceivableCommand.ts` ← create
- `src/application/receivable/commands/updateReceivableDraftCommand.ts` ← create
- `tests/application/payer/upsertPayerByCnpj.test.ts` ← create
- `tests/application/receivable/createReceivableCommand.test.ts` ← create
- `tests/application/receivable/updateReceivableDraftCommand.test.ts` ← create
