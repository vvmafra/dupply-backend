# Task 2.0: DB migration — materialized columns and partial unique indexes

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Adds nullable materialized columns `normalized_bill_number` and `normalized_fiscal_document_key` to the `receivables` table, backfills them from existing JSON metadata using the same normalization rules as the domain module, and creates partial unique indexes scoped to active (duplicate-blocking) statuses. This is the concurrency backstop layer mirroring the wallet module pattern.

Corresponds to **techspec § Component 5 — Database migration**.

Depends on: **1.0** (normalization rules for backfill)

## Requirements

- FR-9: Materialized columns plus partial unique indexes on `(seller_id, normalized_bill_number)` and `(seller_id, normalized_fiscal_document_key)` where `deleted_at IS NULL`, key column IS NOT NULL, and status is in the active duplicate-blocking set
- FR-2 / FR-9: Soft-deleted rows excluded from partial index `WHERE` clause
- Non-unique lookup indexes on `(seller_id, normalized_bill_number)` and `(seller_id, normalized_fiscal_document_key)` for guard query performance
- Keep `src/db/schema.ts` and `src/db/schema.pg.ts` in sync

## Subtasks

- [ ] 2.1 Read `src/db/schema.ts`, `src/db/schema.pg.ts`, existing receivables table definition, and `drizzle/` migrations for numbering and patterns
- [ ] 2.2 Add `normalizedBillNumber` and `normalizedFiscalDocumentKey` columns plus indexes to both schema files
- [ ] 2.3 Create `drizzle/0008_receivable_duplicate_guard.sql` — ALTER columns, backfill, lookup indexes, partial unique indexes
- [ ] 2.4 Implement backfill using domain normalization (Node script in migration review or equivalent SQL) — rows with missing/empty identifying fields stay `NULL`
- [ ] 2.5 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "5. Database migration — materialized columns + partial unique indexes"**.

Partial unique index names (used by `isReceivableUniqueViolation` in task 3):

- `receivables_seller_bill_active_unique`
- `receivables_seller_fiscal_key_active_unique`

Active status list in index `WHERE` must match `DUPLICATE_BLOCKING_STATUSES` from task 1.

**Pre-migration note:** If production already has duplicate active rows for the same seller + key, step 5 will fail. Per PRD, ops must resolve existing duplicates manually before deploy — no automatic merge.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Migration runs cleanly on a fresh local DB
- [ ] `receivables` has `normalized_bill_number` and `normalized_fiscal_document_key` columns
- [ ] Partial unique indexes exist with correct `WHERE` clause (active statuses, non-null key, not soft-deleted)
- [ ] Backfill populates columns for existing rows with identifying metadata
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-duplicate-guard/prd.md` ← read first
- `tasks/prd-receivable-duplicate-guard/techspec.md` ← read first
- `src/domain/receivable/businessKey.ts` ← read (backfill rules)
- `src/db/schema.ts` ← modify
- `src/db/schema.pg.ts` ← modify
- `drizzle/0008_receivable_duplicate_guard.sql` ← create
