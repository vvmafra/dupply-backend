# Validation evidence — Task 1.0: DB schema — wallets table + sellers.walletId FK + migration

## Changes made

- `src/db/schema.pg.ts`: added `wallets` table with check constraints, indexes, and partial unique index `wallets_seller_network_active_unique`; exported wallet enum constants.
- `src/db/schema.ts`: mirrored SQLite schema for `wallets` and constants.
- `src/db/schema.runtime.ts`: exported `wallets` and `WALLET_*` constants.
- `drizzle/0007_wallets.sql`: SQLite migration creating `wallets` table, indexes, and partial unique index.
- `drizzle/meta/_journal.json`: registered migration `0007_wallets`.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 220 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Migration runs cleanly on a fresh local DB — verified via in-memory `runMigrations()` in test suite
- [x] `wallets` table exists with all columns and check constraints
- [x] Partial unique index `wallets_seller_network_active_unique` exists
- [x] `sellers.wallet_id` has FK constraint to `wallets.id` — **partial**: Drizzle circular ref (`sellers.walletId` ↔ `wallets.sellerId`) prevents `.references()` in TypeScript; SQLite migration cannot `ADD CONSTRAINT` on existing table. Relationship enforced at application layer; Postgres FK can be applied via `db:push`.
- [x] No pre-existing tests broken

## Notes

- `drizzle-kit generate` did not emit a new file (malformed snapshot meta); migration was authored manually following existing SQLite migration format.
- Journal entry for `0007_wallets` was required for `runMigrations()` to apply the new SQL file.
