# Task 5.0: DB migration — approved → confirmed data + partial index DDL

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Add a one-time data migration mapping all receivables with `status = 'approved'` to `confirmed`, and recreate partial unique indexes to drop `approved` from the active-status WHERE clause. Historical `payer_rejected` rows are left untouched.

Corresponds to **techspec § Component 6 — DB migration**.

Depends on: **1.0**

## Requirements

- FR-7: Data migration maps `approved → confirmed`; `payer_rejected` rows remain queryable with no automatic transition
- FR-9: Partial unique indexes updated to exclude `approved` from status IN list
- Techspec: Update both `src/db/schema.ts` and `src/db/schema.pg.ts`
- Techspec: No CHECK constraint on `receivables.status` exists today — index DDL only

## Subtasks

- [ ] 5.1 Read `src/db/schema.ts`, `src/db/schema.pg.ts`, and the latest migration in `drizzle/` for partial index patterns
- [ ] 5.2 Create `drizzle/0009_remove_payer_confirmation_gate.sql` with data migration + index recreation (SQLite + Postgres variants as needed)
- [ ] 5.3 Update `.where()` clauses in `schema.ts` and `schema.pg.ts` — remove `approved` from status IN lists
- [ ] 5.4 Run migration locally and verify no receivables remain in `approved` status
- [ ] 5.5 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "6. DB migration"**.

Data migration SQL:

```sql
UPDATE receivables SET status = 'confirmed', updated_at = NOW() WHERE status = 'approved';
```

Partial unique index — active statuses after change:

```sql
status IN ('created','under_review','offer','confirmed','processing','completed','overdue')
```

Apply to both seller-bill and fiscal-document partial unique indexes (mirror existing migration naming: `receivables_seller_bill_active_unique`, etc.).

**Do not** migrate or alter `payer_rejected` rows (OQ-3: keep for audit).

Follow existing project migration conventions (see `scripts/db-deploy.ts` if needed).

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Migration runs successfully against local DB
- [ ] No receivables remain with `status = 'approved'` after migration
- [ ] `payer_rejected` rows are untouched
- [ ] Partial unique indexes no longer reference `approved` in WHERE clause
- [ ] Schema TypeScript files match migration DDL
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-remove-payer-confirmation/prd.md` ← read first
- `tasks/prd-receivable-remove-payer-confirmation/techspec.md` ← read first
- `src/db/schema.ts` ← modify
- `src/db/schema.pg.ts` ← modify
- `drizzle/0009_remove_payer_confirmation_gate.sql` ← create
