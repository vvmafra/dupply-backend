# Validation evidence — Task 3.0: Register seller wallet command + walletHelpers + integration tests

## Changes made

- `src/application/wallet/walletHelpers.ts`: `loadWalletOrThrow`, `toWalletPublicView` (strips `secretEncrypted`), `isWalletUniqueViolation`.
- `src/application/wallet/commands/registerSellerWalletCommand.ts`: atomic INSERT wallet + UPDATE `seller.walletId` in transaction.
- `tests/application/wallet/registerSellerWalletCommand.test.ts`: registration, duplicate, auth, and status scenarios.
- `tests/helpers/walletTestHelpers.ts`: shared valid registration payload fixtures.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 220 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] Active seller with `walletId null` registers wallet and updates `seller.walletId`
- [x] Second POST for same seller/network → `409 wallet_already_exists`
- [x] Non-active seller → `403 seller_not_active`
- [x] Cross-seller registration → `403 forbidden`
- [x] Response never contains `secretEncrypted`
- [x] No pre-existing tests broken

## Notes

- Logging at `info` omitted: `AppDeps` has no `logger` field in this codebase; no sensitive fields are logged in the command.
