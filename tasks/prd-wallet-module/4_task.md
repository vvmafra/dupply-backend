# Task 4.0: Wallet queries + update status command + integration tests

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implements read queries (`executeGetSellerWallet`, `executeGetWalletById`) and the admin-only `executeUpdateWalletStatus` command. Queries enforce authorization via domain policies and return `WalletPublicView` without sensitive fields. Update command handles admin activate/deactivate with FR-11 uniqueness backstop on reactivation.

Corresponds to **techspec § Components 4 and 5 — update status command and queries**.

Depends on: _1.0, 2.0, 3.0_

## Requirements

- FR-6: `GET` responses return `WalletPublicView`; `secretEncrypted` never included; seller (own) or admin can read
- FR-7: `executeUpdateWalletStatus` restricted to admins; only accepts `'active'` or `'inactive'`
- FR-9: `executeGetSellerWallet` returns `404 wallet_not_found` when `seller.walletId === null` (frontend uses existing `GET /v1/sellers/:id` for detection)
- FR-11: reactivating a wallet may hit DB unique index if another active wallet exists — map to `409 wallet_already_exists`
- Integration tests: seller/admin read paths, `walletId null` → 404, admin deactivate/reactivate, seller forbidden on PATCH

## Subtasks

- [ ] 4.1 Read `src/application/seller/queries/` and seller read policies (`assertCanReadSeller`) for reuse patterns
- [ ] 4.2 Create `src/application/wallet/queries/getSellerWalletQuery.ts` implementing `executeGetSellerWallet`
- [ ] 4.3 Create `src/application/wallet/queries/getWalletByIdQuery.ts` implementing `executeGetWalletById`
- [ ] 4.4 Create `src/application/wallet/commands/updateWalletStatusCommand.ts` implementing `executeUpdateWalletStatus`
- [ ] 4.5 Write integration tests `tests/application/wallet/getSellerWalletQuery.test.ts` and `getWalletByIdQuery.test.ts`
- [ ] 4.6 Write integration tests `tests/application/wallet/updateWalletStatusCommand.test.ts`
- [ ] 4.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "4. Application — update wallet status"** and **§ "5. Application — queries"**.

`executeGetSellerWallet` flow:

1. `loadSellerOrThrow` → `assertCanReadSeller(actor, seller)` (reuse seller module policy)
2. If `seller.walletId === null` → throw `WALLET_NOT_FOUND`
3. `loadWalletOrThrow(deps, seller.walletId)` → `assertCanReadWallet(actor, wallet)`
4. Return `toWalletPublicView(wallet)`

`executeGetWalletById` flow:

1. `loadWalletOrThrow(deps, walletId)` → `assertCanReadWallet(actor, wallet)`
2. Return `toWalletPublicView(wallet)`

`executeUpdateWalletStatus` flow:

1. `assertCanUpdateWalletStatus(actor)`
2. `loadWalletOrThrow` → UPDATE status → return updated `WalletPublicView`
3. Log `walletId`, `sellerId`, `network`, `address`, `actorRole` — never log `credentialId` or `signerPublicKey`

DB unique violation on reactivation → map to `409 wallet_already_exists`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Seller GET own wallet via query helpers succeeds; different seller → `403 forbidden`
- [ ] Admin GET any seller wallet succeeds
- [ ] Seller with `walletId null` → `404 wallet_not_found`
- [ ] Admin PATCH deactivate → status `inactive`; reactivate → status `active`
- [ ] Seller PATCH status → `403 forbidden`
- [ ] Response bodies never contain `secretEncrypted`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-wallet-module/prd.md` ← read first
- `tasks/prd-wallet-module/techspec.md` ← read first
- `.cursor/rules/module-wallet.mdc` ← read first
- `src/application/wallet/queries/getSellerWalletQuery.ts` ← create
- `src/application/wallet/queries/getWalletByIdQuery.ts` ← create
- `src/application/wallet/commands/updateWalletStatusCommand.ts` ← create
- `src/application/wallet/walletHelpers.ts` ← read (from task 3)
- `src/domain/seller/policies.ts` ← read (reuse `assertCanReadSeller`)
- `tests/application/wallet/getSellerWalletQuery.test.ts` ← create
- `tests/application/wallet/getWalletByIdQuery.test.ts` ← create
- `tests/application/wallet/updateWalletStatusCommand.test.ts` ← create
