# Task 2.0: Domain foundation — types, errors, metadata validation, policies

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Introduce the canonical domain types, typed error codes, metadata completeness validation, and ownership/read ACL policies for the receivable module. These files contain no HTTP imports and are consumed by application commands and queries in later tasks.

Corresponds to **techspec § Components 2–5** (types, metadata, errors, policies).

Depends on: **1.0**

## Requirements

- FR-2: `assertCanUpdateReceivableDraft` — only `status = 'created'` allowed; otherwise throw `METADATA_LOCKED`
- FR-3: `assertReceivableMetaDataComplete` validates all required fields on submit (not on draft create/patch)
- FR-8: `assertCanViewReceivable` — seller sees own; `risk_analyst`/`risk_analyst_agent`/`admin` see all; `payer` returns false
- FR-12: `ReceivableMetaData` TypeScript shape with English keys per `module-receivables.mdc`
- FR-14: `assertSellerPayerCnpjDiffer` — normalize digits-only compare; throw `SELLER_PAYER_MUST_DIFFER`
- Techspec: `ReceivableError` with stable machine-readable codes for HTTP mapping
- Unit tests for metadata validation and policies

## Subtasks

- [ ] 2.1 Read `.cursor/rules/module-receivables.mdc` for canonical metadata shape
- [ ] 2.2 Create `src/domain/receivable/types.ts` with `ReceivableMetaData` and `ReceivableRow`
- [ ] 2.3 Create `src/domain/receivable/errors.ts` with `RECEIVABLE_ERROR_CODES` and `ReceivableError`
- [ ] 2.4 Create `src/domain/receivable/metadata.ts` with `parseReceivableMetaData` and `assertReceivableMetaDataComplete`
- [ ] 2.5 Create `src/domain/receivable/policies.ts` with ownership, draft update, view ACL, and CNPJ differ guards
- [ ] 2.6 Write unit tests `tests/domain/receivable/metadata.test.ts` and `tests/domain/receivable/policies.test.ts`
- [ ] 2.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "2. Domain types"**, **§ "3. Domain metadata validation"**, **§ "4. Domain errors"**, **§ "5. Domain policies"**.

Metadata completeness runs **only on submit** — draft create/patch may have partial metadata.

Required string fields for completeness check:

```typescript
const REQUIRED_STRING_FIELDS: (keyof ReceivableMetaData)[] = [
  "type", "billNumber", "invoiceNumber", "issuedAt", "dueDate",
  "payerCnpj", "payerLegalName", "payerFinancialEmail",
  "fiscalDocumentType", "fiscalDocumentKey", "proofType", "payerAcceptanceStatus",
];
```

Also require `antifraudDeclarationsAccepted === true` and `desiredAnticipationValue > 0`.

Seller CNPJ for FR-14 is read from `sellers.companyMetaData` JSON (`CompanyMetaData.cnpj`) at command time — policies accept pre-resolved CNPJ strings.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Missing `dueDate` in metadata throws `INCOMPLETE_METADATA`
- [ ] `antifraudDeclarationsAccepted: false` throws `INCOMPLETE_METADATA`
- [ ] PATCH policy rejects `status !== 'created'` with `METADATA_LOCKED`
- [ ] Same seller/payer CNPJ throws `SELLER_PAYER_MUST_DIFFER`
- [ ] Payer role cannot view receivable via `assertCanViewReceivable`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-module/prd.md` ← read first
- `tasks/prd-receivable-module/techspec.md` ← read first
- `.cursor/rules/module-receivables.mdc` ← read first
- `src/domain/receivable/types.ts` ← create
- `src/domain/receivable/errors.ts` ← create
- `src/domain/receivable/metadata.ts` ← create
- `src/domain/receivable/policies.ts` ← create
- `tests/domain/receivable/metadata.test.ts` ← create
- `tests/domain/receivable/policies.test.ts` ← create
