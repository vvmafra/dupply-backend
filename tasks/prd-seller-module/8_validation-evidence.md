# Validation evidence — Task 8.0: Receivable guard integration

## Changes made

- `src/application/receivable/commands/receivableCommands.ts`: join sellers + assertSellerCanCreateReceivable
- `src/routes/v1/receivables.ts`: map seller_not_active → 403
- `tests/application/receivable/receivableCommands.test.ts`: status guard tests

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 130 passing
```

## Success criteria

- [x] active seller creates receivable
- [x] created/in_review/inactive → 403 seller_not_active
- [x] Soft-deleted seller → invalid_seller (no row from join)
- [x] No pre-existing tests broken

## Notes

Soft-deleted sellers are excluded by the join (`sellers.deleted_at IS NULL`), surfacing as `invalid_seller` rather than `seller_not_active` — consistent with missing seller semantics.
