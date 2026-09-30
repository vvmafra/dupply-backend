# Validation evidence — Task 2.0: Domain layer — types, errors, validators, policies + unit tests

## Changes made

- `src/domain/wallet/types.ts`: `WalletPublicView`, status/network constants.
- `src/domain/wallet/errors.ts`: `WalletError` and error codes per techspec.
- `src/domain/wallet/validators.ts`: `assertValidSellerSmartAccountWallet`, Soroban address and signer hex validation.
- `src/domain/wallet/policies.ts`: register/read/update authorization policies.
- `tests/domain/wallet/validators.test.ts`: validation scenarios.
- `tests/domain/wallet/policies.test.ts`: authorization scenarios.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 220 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] Valid Soroban `C...` address passes; invalid address throws `validation_error`
- [x] Empty `credentialId` throws `validation_error`
- [x] Invalid network throws `validation_error`
- [x] Register/read/update policy scenarios covered
- [x] No pre-existing tests broken

## Notes

- Test contract IDs use Stellar base32 charset (A–Z, 2–7 only); IDs containing `0`, `1`, `8`, `9` fail validation as expected.
