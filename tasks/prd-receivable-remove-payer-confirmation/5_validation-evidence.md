# Validation evidence — Task 5.0: DB migration — approved → confirmed data + partial index DDL

## Changes made

- `drizzle/0009_remove_payer_confirmation_gate.sql`: data migration `approved → confirmed` (SQLite `unixepoch()` for `updated_at`); DROP/CREATE partial unique indexes without `approved` in status IN list
- `drizzle/meta/_journal.json`: registered migration `0009_remove_payer_confirmation_gate`
- `src/db/schema.ts` / `src/db/schema.pg.ts`: removed `approved` from partial unique index `.where()` status lists on `receivables_seller_bill_active_unique` and `receivables_seller_fiscal_key_active_unique`

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 280 passing
```

Migration verification (local SQLite):

```
approved count after upgrade → 0
confirmed count (from former approved row) → 1
payer_rejected count unchanged → 1
partial index WHERE clause → no 'approved'
```

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Migration runs successfully against local DB — verified via `runMigrations()` in test suite and direct execution of `0009` SQL on simulated pre-migration state
- [x] No receivables remain with `status = 'approved'` after migration
- [x] `payer_rejected` rows are untouched
- [x] Partial unique indexes no longer reference `approved` in WHERE clause
- [x] Schema TypeScript files match migration DDL
- [x] No pre-existing tests broken

## Notes

- SQLite migration uses `unixepoch()` for `updated_at` (integer timestamp column), not `NOW()` as in the techspec Postgres example — consistent with existing migrations (`0006`–`0008`).
- Postgres applies schema via `npm run db:push` / `db:deploy` from `schema.pg.ts`; no separate Postgres SQL file (project convention per `src/db/index.ts`).
