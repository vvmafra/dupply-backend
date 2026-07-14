# Validation evidence — Task 3.0: Seller + wallet modules

## Changes made

- `src/modules/seller/domain/**`: moved from `src/domain/seller/**` (types, errors, policies, transitions, validators); temporary re-exports at old paths
- `src/modules/seller/application/**`: moved commands, queries, and `sellerHelpers` from `src/application/seller/**`; temporary re-exports at old paths
- `src/modules/seller/api/sellers.ts` + `registerSellerModule.ts`: moved seller HTTP handlers; registrar wraps routes
- `src/modules/wallet/domain/**`: moved from `src/domain/wallet/**` (types, errors, policies, validators); temporary re-exports at old paths
- `src/modules/wallet/application/**`: moved commands, queries, and `walletHelpers` from `src/application/wallet/**`; temporary re-exports at old paths
- `src/modules/wallet/api/wallets.ts` + `registerWalletModule.ts`: moved wallet HTTP handlers; registrar wraps routes
- `src/compose/registerModules.ts`: JWT-protected scope now wires `registerSellerModule` + `registerWalletModule` (replacing legacy route imports)
- `src/modules/auth/api/auth.ts`: `executeRegisterSeller` import updated to seller module path
- `src/routes/v1/sellers.ts`, `wallets.ts`: temporary re-exports to new module api paths
- `tests/modules/seller/**`: moved from `tests/domain/seller` and `tests/application/seller` with updated imports
- `tests/modules/wallet/**`: moved from `tests/domain/wallet` and `tests/application/wallet` with updated imports
- `tests/routes/v1/sellerRoutes.test.ts`, `walletRoutes.test.ts`: import routes from modules

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 288 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified
- [x] Unit tests pass (`npm test`) — 288/288
- [x] Seller routes (`/v1/sellers/*`) behave identically — `sellerRoutes.test.ts` green
- [x] Wallet routes (`/v1/wallets/*`) behave identically — `walletRoutes.test.ts` green
- [x] All seller/wallet code discoverable under `src/modules/seller/` and `src/modules/wallet/` — verified
- [x] Legacy `domain/seller/`, `application/seller/`, `domain/wallet/`, `application/wallet/`, and route files emptied via re-exports (remaining imports from unmigrated modules/scripts)
- [x] No pre-existing tests broken — all prior suites still pass

## Notes

- **Temporary re-exports** left at legacy seller/wallet paths until Phase 8 cleanup (same pattern as Tasks 1–2), because receivable/scripts/helpers still import `domain/seller` types and policies.
- **Cross-module imports preserved as-is** (behavior-preserving): wallet application/domain still references seller helpers/types via `modules/seller/` paths; seller/wallet domain still import `AccountRole` from `modules/account/domain`. No seller → wallet domain import (FR-5 direction called out in the task).
- **`registerSellerModule` / `registerWalletModule`** call route registrars without an extra nested `app.register` — scope grouping lives in `registerModules.ts` to match former hook order.
