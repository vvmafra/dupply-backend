# Task 1.0: Domain business key normalization and duplicate error codes

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Introduces the domain module that defines how receivable business keys are normalized, which statuses block duplicates versus allow resubmission, and how materialized key columns are derived from metadata. Adds granular duplicate error codes to the receivable error catalog. This is the foundation for the application guard, DB migration backfill, and all write-path wiring.

Corresponds to **techspec § Component 1 — Business key definition** and **§ Component 2 — Error codes**.

Depends on: _none_

## Requirements

- FR-1: Two independent business keys per seller — `(sellerId, normalizedBillNumber)` and `(sellerId, normalizedFiscalDocumentKey)` — enforced only when the normalized field is non-null
- FR-4: Add `duplicate_bill_number` and `duplicate_fiscal_document_key` to `RECEIVABLE_ERROR_CODES`
- FR-5: `normalizeBillNumber` (trim + uppercase), `normalizeFiscalDocumentKey` (digits-only for nfe/nfce/nfse; trim only for `other`), `normalizeReceivableMetaDataForStorage` for JSON persistence
- FR-6: `DUPLICATE_TERMINAL_STATUSES` — `reproved`, `rejected`, `payer_rejected`, `payer_settled`
- FR-7: `DUPLICATE_BLOCKING_STATUSES` — `created`, `under_review`, `offer`, `approved`, `confirmed`, `processing`, `completed`, `overdue`
- OQ-6: `deriveMaterializedBusinessKeys` returns `null` per key when source field is missing or empty after normalization

## Subtasks

- [ ] 1.1 Read `src/domain/receivable/errors.ts`, `src/domain/receivable/types.ts`, and `src/domain/receivable/transitions.ts` for existing patterns
- [ ] 1.2 Create `src/domain/receivable/businessKey.ts` with normalization, status sets, `deriveMaterializedBusinessKeys`, and `normalizeReceivableMetaDataForStorage`
- [ ] 1.3 Add `DUPLICATE_BILL_NUMBER` and `DUPLICATE_FISCAL_KEY` to `src/domain/receivable/errors.ts`
- [ ] 1.4 Write unit tests in `tests/domain/receivable/businessKey.test.ts` per techspec test table
- [ ] 1.5 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "1. Business key definition — domain normalization"** and **§ "2. Error codes"**.

Key exports from `businessKey.ts`:

- `DUPLICATE_BLOCKING_STATUSES`, `DUPLICATE_TERMINAL_STATUSES`, `isDuplicateBlockingStatus`
- `normalizeBillNumber`, `normalizeFiscalDocumentKey`, `deriveMaterializedBusinessKeys`, `normalizeReceivableMetaDataForStorage`
- `MaterializedBusinessKeys` type

Bill collision error takes precedence when both dimensions collide (deterministic first check in guard — documented for downstream tasks).

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Bill number `" dup-001 "` normalizes to `"DUP-001"`
- [ ] Fiscal key with `nfe` type strips non-digits; `other` type preserves alphanumeric (trim only)
- [ ] Empty or missing identifying fields yield `null` materialized keys
- [ ] `isDuplicateBlockingStatus` returns true for `under_review`, false for `reproved`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-duplicate-guard/prd.md` ← read first
- `tasks/prd-receivable-duplicate-guard/techspec.md` ← read first
- `.cursor/rules/module-receivables.mdc` ← read first
- `src/domain/receivable/businessKey.ts` ← create
- `src/domain/receivable/errors.ts` ← modify
- `tests/domain/receivable/businessKey.test.ts` ← create
