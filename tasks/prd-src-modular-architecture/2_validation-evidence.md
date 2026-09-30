# Validation evidence — Task 2.0: Pilot modules — auth + account

## Changes made

- `src/modules/account/domain/**`: moved from `src/domain/account/**` (types, errors, policies, profileId); temporary re-exports at old paths
- `src/modules/account/application/**`: moved commands + getAccountQuery from `src/application/account/**`; temporary re-exports at old paths
- `src/modules/account/api/accounts.ts` + `registerAccountModule.ts`: moved account HTTP handlers; registrar wraps routes
- `src/modules/auth/api/auth.ts` + `registerAuthModule.ts`: moved auth HTTP handlers (login, refresh, logout, register); empty `application/` + `domain/` placeholders (`.gitkeep`)
- `src/compose/registerModules.ts`: wires cookie/cors/swagger + auth scope groups matching former `server.ts` lines 61–87; auth/account via modules, other routes still legacy until Phases 3–6
- `src/server.ts`: thin bootstrap — load config, create db, create gateways, `registerAllModules`
- `src/routes/v1/auth.ts`, `accounts.ts`: temporary re-exports to new module api paths
- `src/infra/auth/jwt.ts`, `refreshToken.ts`: imports updated to `modules/account/domain`
- `tests/modules/account/**`: moved from `tests/domain/account` and `tests/application/account` with updated imports
- `tests/routes/v1/accountAuthRoutes.test.ts` (+ seller/wallet/receivables route tests): import auth/account from modules

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 288 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified
- [x] Unit tests pass (`npm test`) — 288/288
- [x] `POST /v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout` behave identically — `accountAuthRoutes.test.ts` green
- [x] Account routes (`/v1/accounts/*`) behave identically — same suite green
- [x] `server.ts` delegates to `registerAllModules`; no business logic in bootstrap — verified
- [x] Legacy `routes/v1/auth.ts`, `routes/v1/accounts.ts`, `domain/account/`, `application/account/` emptied via re-exports (remaining imports from unmigrated modules)
- [x] No pre-existing tests broken — all prior suites still pass

## Notes

- **Temporary re-exports** left at legacy account/auth paths until Phase 8 cleanup (same pattern as Task 1.0), because wallet/seller/receivable/plugins still import `domain/account` types.
- **`registerAllModules`** registers auth + account via vertical modules and still wires legacy seller/wallet/payer/receivable/ramp/trade-bill routes so HTTP contracts stay intact (later tasks replace those imports).
- **`registerAuthModule` / `registerAccountModule`** call route registrars without an extra nested `app.register` — scope grouping lives in `registerModules.ts` to match former hook order.
- Auth still imports `executeRegisterSeller` from `application/seller` until Phase 3 moves seller.
- `profileId.ts` still uses Drizzle (pre-existing domain impurity) — moved as-is, behavior-preserving.
