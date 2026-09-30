# Validation evidence — Task 6.0: Seller queries

## Changes made

- `src/application/seller/queries/getSellerQuery.ts`: get with authorization + toReais mapping
- `src/application/seller/queries/listSellersQuery.ts`: admin/risk_analyst list with filters
- Application tests for get and list queries

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 130 passing
```

## Success criteria

- [x] SellerPublicView returns money in reais
- [x] Soft-deleted → 404 for non-admin
- [x] risk_analyst reads in_review only
- [x] List excludes soft-deleted rows
- [x] Seller role cannot list → 403

## Notes

None.
