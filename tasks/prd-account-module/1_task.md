# Task 1.0: Add `accounts` schema and migration (drop `platform_users`)

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Introduce the `accounts` table as the new root identity for human authentication, including the `refresh_token_lookup` column for indexed refresh-token lookup. Drop the legacy `platform_users` table and remove receivable FK constraints that reference it. This is the foundation every other account-module task depends on.

Depends on: none

## Requirements

- FR-1: Persist human identities in `accounts` with `id`, `status`, `email`, `passwordHash`, `role`, `refreshToken`, timestamps, and `deletedAt`
- FR-2: Enforce mutually exclusive roles (`seller` | `risk_analyst` | `admin`) at schema level
- FR-3: No payer accounts — schema supports only human roles listed above
- FR-6: Store `passwordHash`, never plain text
- FR-7: Default `status` to `active`
- FR-18: Drop `platform_users` (greenfield — no data migration)
- FR-20: Use native PostgreSQL `timestamp` columns (`created_at`, `updated_at`, `deleted_at`)

## Subtasks

- [x] 1.1 Read `src/db/schema.pg.ts`, `src/db/schema.ts`, and `src/db/schema.runtime.ts` to understand the dual-schema pattern
- [x] 1.2 Add `accounts` table with `ACCOUNT_STATUSES`, `ACCOUNT_ROLES`, and `refresh_token_lookup` column (indexed)
- [x] 1.3 Remove `platformUsers` table definition from both schema files
- [x] 1.4 Update `schema.runtime.ts` to export `accounts` instead of `platformUsers`
- [x] 1.5 Create Drizzle migration: `CREATE TABLE accounts`, drop receivable FK constraints on `seller_user_id` / `payer_user_id`, `DROP TABLE platform_users`
- [x] 1.6 Verify no TypeScript errors (`npm run lint`)

## Implementation details

See techspec **§1 Database schema — `accounts` table**.

Key points:
- Postgres canonical schema in `schema.pg.ts`; mirror in `schema.ts` for SQLite dev pattern
- `refresh_token_lookup` stores `sha256(plainRefreshToken)` for O(1) lookup (see techspec §4)
- Migration drops FK constraints on `receivables.seller_user_id` and `receivables.payer_user_id` but leaves columns as plain `text` (Module 5 will rename)
- Add `@paralleldrive/cuid2` to `package.json` if not already present (used when inserting accounts in later tasks)
- No dev seed script in this module (PRD D-7)

```typescript
// refresh_token_lookup column — add alongside refreshToken
refreshTokenLookup: text("refresh_token_lookup"),
// index on refreshTokenLookup in table definition
```

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Migration file exists and creates `accounts` with all required columns and indexes
- [x] `platform_users` table definition removed from schema files
- [x] Receivable FK constraints to `platform_users` dropped in migration
- [x] `schema.runtime.ts` exports `accounts`
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-account-module/prd.md` ← read first
- `tasks/prd-account-module/techspec.md` ← read first
- `src/db/schema.ts` ← modify
- `src/db/schema.pg.ts` ← modify
- `src/db/schema.runtime.ts` ← modify
- `drizzle/0004_accounts_drop_platform_users.sql` ← create
- `package.json` ← modify (cuid2 if needed)
