# Validation evidence — Task 2.0: DB migration — materialized columns and partial unique indexes

## Changes made

- `src/db/schema.ts` / `src/db/schema.pg.ts`: added `normalizedBillNumber`, `normalizedFiscalDocumentKey`, lookup indexes, partial unique indexes
- `drizzle/0008_receivable_duplicate_guard.sql`: ALTER columns, SQL backfill, indexes
- `drizzle/meta/_journal.json`: registered migration 0008

## Test results

```
npm test → ✅ 274 passing (runMigrations applies 0008 in test DB)
npm run lint → ⚠️ pre-existing transaction.ts errors only
```

## Success criteria

- [x] Schema updated in both SQLite and Postgres definitions
- [x] Migration registered and applied via `runMigrations` in tests
- [x] Partial unique indexes `receivables_seller_bill_active_unique` and `receivables_seller_fiscal_key_active_unique` with active-status WHERE clause
- [x] SQL backfill for bill number (upper/trim) and fiscal key (digits or trim for `other`)
- [x] No pre-existing tests broken

## Notes

Backfill uses SQL JSON extraction with chained `replace` for fiscal keys (non-`other` types). Matches domain rules for typical NF-e formatting.
