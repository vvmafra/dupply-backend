# Task 1.0: DB schema (sellers table + migration) + shared money utility

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Creates the `sellers` table in the database schema (Drizzle ORM) and generates the corresponding SQL migration. Also introduces the platform-wide `src/shared/money.ts` utility (`toCents` / `toReais`) that all future money-bearing modules will use. Both pieces are pure infrastructure with no business logic — they are the foundation every other task depends on.

Corresponds to **techspec components 1 and 2**.

Depends on: _none_

## Requirements

- `sellers` table as specified in techspec component 1: all columns (`id`, `status`, `name`, `companyMetaData`, `legalRepresentativeMetaData`, `businessRelationsMetaData`, `accountId`, `walletId`, `createdAt`, `updatedAt`, `deletedAt`), status check constraint, two indexes (`sellers_status_idx`, `sellers_account_id_idx`), unique constraint on `accountId` (FR-2)
- `walletId` is nullable `text` with **no FK constraint** in this migration — wallets table does not exist yet (FR-17)
- JSON metadata columns stored as `text` (consistent with existing `receivableMd` pattern)
- Migration file `drizzle/0005_sellers.sql` — single `CREATE TABLE` with indexes and check constraint
- `src/shared/money.ts` implements `toCents(reais: number): number` and `toReais(cents: number): number` per `money.mdc` convention (FR-5)
- Unit tests for `toCents` and `toReais` covering edge cases (zero, large values, rounding)

## Subtasks

- [ ] 1.1 Read `src/db/schema.ts`, `src/db/schema.pg.ts`, and `src/db/schema.runtime.ts` to understand the existing schema patterns (table definitions, index/check conventions)
- [ ] 1.2 Add `sellers` table definition to `src/db/schema.pg.ts` with all columns, check constraint, and indexes
- [ ] 1.3 Mirror the `sellers` table in `src/db/schema.ts` (SQLite/shared schema)
- [ ] 1.4 Export `sellers` from `src/db/schema.runtime.ts`
- [ ] 1.5 Create migration `drizzle/0005_sellers.sql` with `CREATE TABLE sellers (...)`, indexes, and check constraint
- [ ] 1.6 Create `src/shared/money.ts` with `toCents` and `toReais`
- [ ] 1.7 Write unit tests `tests/shared/money.test.ts` covering `toCents`, `toReais`, rounding, and zero
- [ ] 1.8 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "1. Database schema — sellers table"** and **§ "2. Shared money utility"**.

Exact schema definition to follow:

```typescript
// src/db/schema.pg.ts
export const SELLER_STATUSES = ["created", "in_review", "active", "inactive"] as const;

export const sellers = pgTable(
  "sellers",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("created"),
    name: text("name").notNull(),
    companyMetaData: text("company_meta_data").notNull(),
    legalRepresentativeMetaData: text("legal_representative_meta_data").notNull(),
    businessRelationsMetaData: text("business_relations_meta_data").notNull(),
    accountId: text("account_id")
      .notNull()
      .unique()
      .references(() => accounts.id),
    walletId: text("wallet_id"), // nullable; FK deferred to wallet module
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "sellers_status_check",
      sql`${t.status} IN ('created', 'in_review', 'active', 'inactive')`,
    ),
    index("sellers_status_idx").on(t.status),
    index("sellers_account_id_idx").on(t.accountId),
  ],
);
```

Money convention (API in reais, DB in cents — `money.mdc` wins over PRD FR-5):

```typescript
// src/shared/money.ts
export const toCents = (reais: number): number => Math.round(reais * 100);
export const toReais = (cents: number): number => Math.round(cents) / 100;
```

Initial JSON defaults (used by registerSellerCommand in task 3):

```typescript
export const EMPTY_COMPANY_METADATA = JSON.stringify({});
export const EMPTY_LEGAL_REP_METADATA = JSON.stringify({});
export const EMPTY_BUSINESS_RELATIONS_METADATA = JSON.stringify({ clients: [], suppliers: [] });
```

Consider exporting these constants from `src/domain/seller/types.ts` (created in task 2) — do NOT put them in `money.ts`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] `sellers` table is queryable in a local DB after running the migration
- [ ] `toCents(150000.00)` returns `15000000`
- [ ] `toReais(15000000)` returns `150000`
- [ ] `toCents(0)` returns `0`; `toReais(0)` returns `0`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-seller-module/prd.md` ← read first
- `tasks/prd-seller-module/techspec.md` ← read first
- `src/db/schema.ts` ← modify
- `src/db/schema.pg.ts` ← modify
- `src/db/schema.runtime.ts` ← modify
- `drizzle/0005_sellers.sql` ← create
- `src/shared/money.ts` ← create
- `tests/shared/money.test.ts` ← create
