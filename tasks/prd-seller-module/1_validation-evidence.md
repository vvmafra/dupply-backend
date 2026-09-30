# Validation evidence — Task 1.0: DB schema + shared money utility

## Changes made

- `src/db/schema.pg.ts` / `src/db/schema.ts`: added `sellers` table with status check, indexes, unique `accountId` FK
- `src/db/schema.runtime.ts`: exported `sellers`
- `drizzle/0005_sellers.sql` + `drizzle/meta/_journal.json`: migration for SQLite
- `src/shared/money.ts`: `toCents` / `toReais` per money.mdc
- `tests/shared/money.test.ts`: unit tests for money conversion

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 130 passing
```

## Success criteria

- [x] Code compiles — `npm run lint` passes
- [x] Unit tests pass — money tests included in full suite
- [x] `sellers` table queryable after migration — verified via test DB migrations
- [x] `toCents(150000.00)` → `15000000` — tested
- [x] `toReais(15000000)` → `150000` — tested
- [x] Zero edge cases — tested
- [x] No pre-existing tests broken

## Notes

Added journal entry for `0005_sellers` manually so Drizzle migrator picks up the new SQL file.
