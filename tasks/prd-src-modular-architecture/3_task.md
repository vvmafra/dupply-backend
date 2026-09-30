# Task 3.0: Seller + wallet modules

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Migrates seller and wallet bounded contexts to vertical slices under `src/modules/seller/` and `src/modules/wallet/`, each with `api/`, `application/`, and `domain/`. Extends `registerAllModules` to wire seller and wallet routes under the JWT-protected scope. Validates that the modular pattern scales beyond the auth/account pilot.

Corresponds to **techspec §1 Target module map (seller, wallet)** and **Migration Phase 3**.

Depends on: **2.0**

## Requirements

- FR-1: `seller` and `wallet` bounded contexts under `src/modules/{name}/`
- FR-2: Each module contains `api/`, `application/`, and `domain/` subfolders
- FR-4: Module application code must not import vendor SDKs directly
- FR-7: All existing `/v1/sellers/*` and `/v1/wallets/*` routes unchanged
- FR-18: Update test paths to `tests/modules/seller/**` and `tests/modules/wallet/**`
- FR-8: `npm run lint` and `npm test` pass at end of phase

## Subtasks

- [x] 3.1 Read `src/routes/v1/sellers.ts`, `src/routes/v1/wallets.ts`, `src/domain/seller/**`, `src/domain/wallet/**`, and corresponding application layers
- [x] 3.2 Create `src/modules/seller/` — move domain, application, and `api/sellers.ts`
- [x] 3.3 Create `src/modules/wallet/` — move domain, application, and `api/wallets.ts`
- [x] 3.4 Implement `registerSellerModule` and `registerWalletModule`; add to JWT-protected scope in `registerModules.ts`
- [x] 3.5 Move domain/application tests to `tests/modules/seller/**` and `tests/modules/wallet/**`
- [x] 3.6 Update `tests/routes/v1/sellerRoutes.test.ts` and `tests/routes/v1/walletRoutes.test.ts` import paths
- [x] 3.7 Verify no TypeScript errors (`npm run lint`) and all tests pass (`npm test`)

## Implementation details

Reference **techspec §1 Target module map** and **§5 Fastify module registration**.

Wallet route file should remain thin — Zod validation, auth guards, error mapping, delegation to application commands (pattern established in wallet module PRD).

Seller and wallet register inside the JWT-protected scope:

```typescript
await app.register(async (scope) => {
  scope.addHook("preHandler", requireJwt(deps.config));
  // ... account, seller, wallet, receivable (receivable added in Task 4)
  await registerSellerModule(scope, deps);
  await registerWalletModule(scope, deps);
});
```

Cross-module relationship (seller → wallet) uses explicit IDs in DB — no direct import of wallet domain from seller application (FR-5).

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] Seller routes (`/v1/sellers/*`) behave identically — route tests green
- [x] Wallet routes (`/v1/wallets/*`) behave identically — route tests green
- [x] All seller/wallet code discoverable under respective `src/modules/{name}/` folders
- [x] Legacy `domain/seller/`, `application/seller/`, `domain/wallet/`, `application/wallet/`, and route files emptied of logic
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-src-modular-architecture/prd.md` ← read first
- `tasks/prd-src-modular-architecture/techspec.md` ← read first
- `.cursor/rules/module-seller.mdc` ← read for domain conventions
- `.cursor/rules/module-wallet.mdc` ← read for domain conventions
- `src/routes/v1/sellers.ts` ← move
- `src/routes/v1/wallets.ts` ← move
- `src/domain/seller/**` ← move
- `src/domain/wallet/**` ← move
- `src/application/seller/**` ← move
- `src/application/wallet/**` ← move
- `src/modules/seller/**` ← create
- `src/modules/wallet/**` ← create
- `src/compose/registerModules.ts` ← extend
- `tests/modules/seller/**` ← create/move
- `tests/modules/wallet/**` ← create/move
- `tests/routes/v1/sellerRoutes.test.ts` ← update
- `tests/routes/v1/walletRoutes.test.ts` ← update
