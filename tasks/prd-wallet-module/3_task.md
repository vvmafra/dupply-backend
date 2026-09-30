# Task 3.0: Register seller wallet command + walletHelpers + integration tests

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implements `executeRegisterSellerWallet` — the application command that atomically inserts a wallet row and updates `seller.walletId` in a single DB transaction after the frontend SDK creates the smart account on-chain. Also introduces shared `walletHelpers` (`loadWalletOrThrow`, `toWalletPublicView`) used by subsequent tasks.

Corresponds to **techspec § Component 3 — Application register command** and partial **§ Component 5 — walletHelpers**.

Depends on: _1.0, 2.0_

## Requirements

- FR-2: command sets `type = 'smart_account'`, `parentType = 'seller'`, `secretEncrypted = null`, non-null `credentialId` and `signerPublicKey`
- FR-3: `signerPublicKey` persisted from registration payload
- FR-4: only the authenticated seller who owns the profile can register; reject if active wallet already exists on same network
- FR-5: atomic transaction — INSERT `wallets` + UPDATE `sellers.walletId`
- FR-8: no backend funding — command never calls Stellar/Friendbot; accepts `network = 'testnet'` as payload only
- FR-10: log `walletId`, `sellerId`, `network`, `address` at info; **never** log `credentialId` or `signerPublicKey`
- FR-11: application-layer duplicate check before insert (DB partial unique index is backstop)
- Integration tests: successful registration, atomic rollback, duplicate POST → `409`, `secretEncrypted` absent from response

## Subtasks

- [ ] 3.1 Read `src/application/seller/sellerHelpers.ts` and an existing command (e.g. `registerSellerCommand.ts`) for transaction and error-mapping patterns
- [ ] 3.2 Create `src/application/wallet/walletHelpers.ts` with `loadWalletOrThrow` and `toWalletPublicView` (strips `secretEncrypted`)
- [ ] 3.3 Create `src/application/wallet/commands/registerSellerWalletCommand.ts` implementing `executeRegisterSellerWallet`
- [ ] 3.4 Write integration tests `tests/application/wallet/registerSellerWalletCommand.test.ts`
- [ ] 3.5 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "3. Application — register seller wallet (command)"**.

Command flow:

1. `loadSellerOrThrow(deps, sellerId)`
2. `assertCanRegisterSellerWallet(actor, seller, payload.network)`
3. `assertValidSellerSmartAccountWallet(payload)`
4. Query for existing active wallet on `(sellerId, network)` — throw `wallet_already_exists` if found
5. `db.transaction`: INSERT wallet + UPDATE `sellers.walletId`

Fixed insert values for seller smart accounts:

| Field | Value |
|-------|-------|
| `type` | `'smart_account'` |
| `parentType` | `'seller'` |
| `address` | `payload.contractId` |
| `secretEncrypted` | `null` |
| `status` | `'active'` |

`toWalletPublicView` must never include `secretEncrypted` in the returned object (FR-6).

Logging example (safe fields only):

```typescript
deps.logger.info({ walletId, sellerId, network, address }, "seller wallet registered");
```

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Active seller with `walletId null` registers wallet → returns `WalletPublicView`, `seller.walletId` updated
- [ ] Transaction rollback on failure leaves `walletId null` and no wallet row
- [ ] Second POST for same seller/network → `409 wallet_already_exists`
- [ ] Non-active seller cannot register → `403 seller_not_active`
- [ ] Seller cannot register for another seller's profile → `403 forbidden`
- [ ] Response body never contains `secretEncrypted`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-wallet-module/prd.md` ← read first
- `tasks/prd-wallet-module/techspec.md` ← read first
- `.cursor/rules/module-wallet.mdc` ← read first
- `src/application/wallet/walletHelpers.ts` ← create
- `src/application/wallet/commands/registerSellerWalletCommand.ts` ← create
- `src/application/seller/sellerHelpers.ts` ← read (reuse `loadSellerOrThrow`)
- `tests/application/wallet/registerSellerWalletCommand.test.ts` ← create
