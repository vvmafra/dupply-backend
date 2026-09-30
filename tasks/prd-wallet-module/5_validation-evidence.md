# Validation evidence — Task 5.0: HTTP routes, server wiring, route tests, API docs, and seller cleanup

## Changes made

- `src/routes/v1/wallets.ts`: four wallet routes with Zod schemas and `mapWalletError`.
- `src/server.ts`: registered `registerWalletRoutes` behind JWT scope.
- `src/application/seller/commands/transitionSellerStatusCommand.ts`: removed `@todo(wallet-module)` block.
- `API.md`: documented wallet endpoints.
- `tests/routes/v1/walletRoutes.test.ts`: E2E register/read/PATCH/auth/validation scenarios.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 220 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] All four wallet routes respond with correct status codes and shapes
- [x] `POST` returns `201` without `secretEncrypted`
- [x] Duplicate registration returns `409 wallet_already_exists`
- [x] Cross-seller access returns `403`
- [x] Admin can read and PATCH status; seller PATCH → `403`
- [x] `transitionSellerStatusCommand` no longer contains `@todo(wallet-module)`
- [x] `API.md` documents wallet endpoints
- [x] No pre-existing tests broken

## Notes

- Full onboarding flow test covers approve → register → GET seller with `walletId` set.
