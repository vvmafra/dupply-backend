# Validation evidence — Task 4.0: Wallet queries + update status command + integration tests

## Changes made

- `src/application/wallet/queries/getSellerWalletQuery.ts`: seller/admin read via `seller.walletId`.
- `src/application/wallet/queries/getWalletByIdQuery.ts`: read by wallet PK with `assertCanReadWallet`.
- `src/application/wallet/commands/updateWalletStatusCommand.ts`: admin activate/deactivate with unique-violation mapping.
- `tests/application/wallet/getSellerWalletQuery.test.ts`
- `tests/application/wallet/getWalletByIdQuery.test.ts`
- `tests/application/wallet/updateWalletStatusCommand.test.ts`

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 220 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] Seller/admin read paths succeed; cross-seller read blocked
- [x] `walletId null` → `404 wallet_not_found`
- [x] Admin deactivate/reactivate works; seller PATCH → `403 forbidden`
- [x] Response bodies never contain `secretEncrypted`
- [x] No pre-existing tests broken

## Notes

- Cross-seller access to `GET seller wallet` is rejected by `assertCanReadSeller` (`SellerError forbidden`) before wallet policy — correct per techspec reuse of seller read policy.
