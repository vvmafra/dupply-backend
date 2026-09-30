# Task 1.0: DB schema — wallets table + sellers.walletId FK + migration

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Creates the `wallets` table in the database schema (Drizzle ORM) and adds the FK constraint on the existing nullable `sellers.walletId` column. Generates the corresponding SQL migration. This is pure infrastructure with no business logic — the foundation every other wallet task depends on.

Corresponds to **techspec § Component 1 — Database schema**.

Depends on: _none_

## Requirements

- FR-1: `wallets` table stores `address`, `credentialId`, `network`, `type`, `parentType`, `sellerId`, `createdTxHash`, `signerPublicKey`, `status`, and standard timestamps (`createdAt`, `updatedAt`, `deletedAt`)
- FR-11: partial unique index `wallets_seller_network_active_unique` on `(sellerId, network)` where `status = 'active'`, `parentType = 'seller'`, and `deletedAt IS NULL`
- Techspec: add FK `sellers.wallet_id → wallets.id` (column already exists as nullable text from seller module)
- Migration file `drizzle/0007_wallets.sql` — `CREATE TABLE wallets`, indexes, checks, and `ALTER TABLE sellers ADD CONSTRAINT`
- Keep `src/db/schema.ts` and `src/db/schema.pg.ts` in sync; export `wallets` from `src/db/schema.runtime.ts`

## Subtasks

- [ ] 1.1 Read `src/db/schema.ts`, `src/db/schema.pg.ts`, `src/db/schema.runtime.ts`, and existing migrations to understand schema patterns
- [ ] 1.2 Add `wallets` table definition to `src/db/schema.pg.ts` with all columns, check constraints, indexes, and partial unique index
- [ ] 1.3 Add `.references(() => wallets.id)` on `sellers.walletId` in both schema files
- [ ] 1.4 Mirror changes in `src/db/schema.ts` (SQLite/shared schema)
- [ ] 1.5 Export `wallets` and wallet enum constants from `src/db/schema.runtime.ts`
- [ ] 1.6 Create migration `drizzle/0007_wallets.sql`
- [ ] 1.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "1. Database schema — wallets table + sellers.walletId FK"**.

Key schema elements:

```typescript
export const WALLET_STATUSES = ["active", "inactive"] as const;
export const WALLET_NETWORKS = ["testnet", "mainnet"] as const;
export const WALLET_TYPES = ["smart_account", "classic_wallet"] as const;
export const WALLET_PARENT_TYPES = ["seller", "platform"] as const;

export const wallets = pgTable("wallets", { /* see techspec */ }, (t) => [
  check("wallets_status_check", sql`${t.status} IN ('active', 'inactive')`),
  check("wallets_network_check", sql`${t.network} IN ('testnet', 'mainnet')`),
  check("wallets_type_check", sql`${t.type} IN ('smart_account', 'classic_wallet')`),
  check("wallets_parent_type_check", sql`${t.parentType} IN ('seller', 'platform')`),
  index("wallets_seller_id_idx").on(t.sellerId),
  index("wallets_address_network_idx").on(t.address, t.network),
  uniqueIndex("wallets_seller_network_active_unique")
    .on(t.sellerId, t.network)
    .where(sql`${t.status} = 'active' AND ${t.parentType} = 'seller' AND ${t.deletedAt} IS NULL`),
]);
```

Migration steps:
1. `CREATE TABLE wallets (...)` with all checks and indexes.
2. `ALTER TABLE sellers ADD CONSTRAINT sellers_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallets(id);`

Safe to add FK — no existing `wallet_id` values in production data.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Migration runs cleanly on a fresh local DB
- [ ] `wallets` table exists with all columns and check constraints
- [ ] Partial unique index `wallets_seller_network_active_unique` exists
- [ ] `sellers.wallet_id` has FK constraint to `wallets.id`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-wallet-module/prd.md` ← read first
- `tasks/prd-wallet-module/techspec.md` ← read first
- `.cursor/rules/module-wallet.mdc` ← read first
- `src/db/schema.ts` ← modify
- `src/db/schema.pg.ts` ← modify
- `src/db/schema.runtime.ts` ← modify
- `drizzle/0007_wallets.sql` ← create
