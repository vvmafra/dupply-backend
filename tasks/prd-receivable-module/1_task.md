# Task 1.0: DB schema migration — payers table + receivables v2

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Drop and recreate the prototype `receivables` table with the v2 schema (`seller_id`/`payer_id` FKs, native timestamps, structured metadata column). Co-ship the minimal `payers` table required for FK constraints (Module 4 minimal schema). This is pure infrastructure — no business logic — and is the foundation every other task depends on.

Corresponds to **techspec § Component 1 — DB schema migration**.

Depends on: _none_

## Requirements

- FR-11: `seller_id` FK → `sellers.id`, `payer_id` FK → `payers.id`, native `timestamp` for `created_at`/`updated_at`/`deleted_at`, `text` decimal for `value`/`proposed_value`
- FR-12: `receivable_meta_data` stored as JSON string column
- Techspec: migration `drizzle/0006_receivables_v2.sql` drops existing `receivables` (no data backfill — non-production module)
- Techspec: create `payers` table if not present, with `cnpj` unique constraint
- Keep `src/db/schema.ts` and `src/db/schema.pg.ts` in sync
- Export new tables from `src/db/schema.runtime.ts` if that is the project convention

## Subtasks

- [ ] 1.1 Read `src/db/schema.ts`, `src/db/schema.pg.ts`, and existing migrations to understand schema patterns
- [ ] 1.2 Add `payers` table definition to both schema files
- [ ] 1.3 Replace `receivables` table definition with v2 columns and indexes (`seller_id`, `payer_id`, `status`)
- [ ] 1.4 Create migration `drizzle/0006_receivables_v2.sql` — `DROP TABLE IF EXISTS receivables`, `CREATE TABLE payers`, `CREATE TABLE receivables`
- [ ] 1.5 Export tables from `src/db/schema.runtime.ts` if applicable
- [ ] 1.6 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "1. DB schema migration — drizzle/0006_receivables_v2.sql"**.

Key schema shape:

```typescript
export const payers = pgTable("payers", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("active"),
  legalName: text("legal_name").notNull(),
  email: text("email").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const receivables = pgTable("receivables", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  sellerId: text("seller_id").notNull().references(() => sellers.id),
  payerId: text("payer_id").notNull().references(() => payers.id),
  receivableMetaData: text("receivable_meta_data"),
  value: text("value").notNull(),
  proposedValue: text("proposed_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("receivables_seller_id_idx").on(t.sellerId),
  index("receivables_payer_id_idx").on(t.payerId),
  index("receivables_status_idx").on(t.status),
]);
```

Remove legacy columns: `seller_user_id`, `payer_user_id`, `created_at_ms`, `updated_at_ms`, `receivable_md`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Migration runs cleanly on a fresh local DB
- [ ] `receivables` has FK constraints to `sellers` and `payers`
- [ ] All three indexes exist on `receivables`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-module/prd.md` ← read first
- `tasks/prd-receivable-module/techspec.md` ← read first
- `src/db/schema.ts` ← modify
- `src/db/schema.pg.ts` ← modify
- `src/db/schema.runtime.ts` ← modify (if applicable)
- `drizzle/0006_receivables_v2.sql` ← create
