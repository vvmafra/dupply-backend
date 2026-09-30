# Validation evidence — Task 1.0: DB schema migration — payers table + receivables v2

## Changes made

- `src/db/schema.ts`: Added `payers` table; replaced `receivables` with v2 columns (`seller_id`, `payer_id`, timestamps, `receivable_meta_data`).
- `src/db/schema.pg.ts`: Same changes for Postgres/Supabase parity.
- `src/db/schema.runtime.ts`: Exported `payers`.
- `drizzle/0006_receivables_v2.sql`: DROP/recreate `receivables`; CREATE `payers` + indexes.
- `drizzle/meta/_journal.json`: Registered migration `0006_receivables_v2`.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 182 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Migration runs cleanly on a fresh local DB — verified via in-memory SQLite tests using `runMigrations`
- [x] `receivables` has FK constraints to `sellers` and `payers` — defined in schema + migration SQL
- [x] All three indexes exist on `receivables` — `seller_id`, `payer_id`, `status`
- [x] No pre-existing tests broken

## Notes

Journal entry for `0006` was required for Drizzle migrator to apply the new SQL file in tests.
