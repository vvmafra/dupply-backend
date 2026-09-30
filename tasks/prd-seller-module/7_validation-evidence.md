# Validation evidence — Task 7.0: HTTP routes + server wiring

## Changes made

- `src/routes/v1/sellers.ts`: 6 seller routes + mapSellerError
- `src/routes/v1/auth.ts`: POST /v1/auth/register with auto-login tokens
- `src/server.ts`: registered seller routes behind JWT
- `API.md`: register + seller endpoints + money convention
- `tests/routes/v1/sellerRoutes.test.ts`: full onboarding E2E flow
- Updated `tests/routes/v1/accountAuthRoutes.test.ts`

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 130 passing
```

## Success criteria

- [x] Register returns 201 with tokens + sellerId
- [x] unsupported role → 400
- [x] GET/PATCH/DELETE authorization enforced
- [x] metadata_locked on PATCH after submit
- [x] API.md updated

## Notes

None.
