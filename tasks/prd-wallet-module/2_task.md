# Task 2.0: Domain layer — types, errors, validators, policies + unit tests

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implements the wallet bounded context domain layer: public view types, error codes, payload validators for seller smart-account registration, and authorization policies. All functions are pure (no I/O). Unit tests cover validators and policies per the techspec test strategy.

Corresponds to **techspec § Component 2 — Domain**.

Depends on: _1.0_

## Requirements

- FR-2: seller `smart_account` invariants documented — `type = 'smart_account'`, `credentialId` non-null, `secretEncrypted` null (enforced at command layer; validator asserts payload)
- FR-3: `signerPublicKey` validated as 65-byte secp256r1 hex (128–130 chars, optional `0x` prefix)
- FR-4: `assertCanRegisterSellerWallet` — actor must own seller profile
- FR-6: `WalletPublicView` must omit `secretEncrypted`
- FR-7: `assertCanUpdateWalletStatus` — admin only
- FR-9: registration policy blocks when `seller.walletId !== null`
- FR-11: registration policy + duplicate guard semantics aligned with one active wallet per seller per network
- Error codes: `wallet_not_found`, `seller_not_found`, `forbidden`, `seller_not_active`, `wallet_already_exists`, `validation_error`, `invalid_wallet_status`

## Subtasks

- [ ] 2.1 Read `src/domain/seller/` (errors, policies, types) to match existing domain patterns
- [ ] 2.2 Create `src/domain/wallet/types.ts` with `WalletPublicView`, status/network/type constants
- [ ] 2.3 Create `src/domain/wallet/errors.ts` with `WalletError` and error codes
- [ ] 2.4 Create `src/domain/wallet/validators.ts` with `assertValidSellerSmartAccountWallet` and `RegisterSellerWalletPayload`
- [ ] 2.5 Create `src/domain/wallet/policies.ts` with `assertCanRegisterSellerWallet`, `assertCanReadWallet`, `assertCanUpdateWalletStatus`
- [ ] 2.6 Write unit tests `tests/domain/wallet/validators.test.ts` — valid/invalid contractId, signerPublicKey, credentialId, network
- [ ] 2.7 Write unit tests `tests/domain/wallet/policies.test.ts` — register/read/update authorization scenarios from techspec test strategy
- [ ] 2.8 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "2. Domain — types, validators, policies, errors"**.

Validation regexes:

```typescript
/** Soroban contract IDs start with 'C' and are 56 chars (Stellar strkey). */
const SOROBAN_CONTRACT_ID = /^C[A-Z2-7]{55}$/;

/** 65-byte secp256r1 uncompressed public key as 130-char hex (0x04 prefix optional). */
const SIGNER_PUBLIC_KEY_HEX = /^(0x)?[0-9a-fA-F]{128,130}$/;
```

Policy highlights:

- `assertCanRegisterSellerWallet`: seller not deleted, actor owns seller, seller `status === 'active'`, `walletId === null`
- `assertCanReadWallet`: admin bypass; seller can read own wallet (`parentType === 'seller'` && `sellerId === actor.profileId`)
- `assertCanUpdateWalletStatus`: `actor.role === 'admin'`

Reuse `AccountRole` and `SellerStatus` types from existing domain modules — do not redefine.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Valid Soroban `C...` address passes validation; `G...` or short string throws `validation_error`
- [ ] Empty `credentialId` throws `validation_error`
- [ ] Invalid network (`"devnet"`) throws `validation_error`
- [ ] Register policy: own active seller with `walletId null` passes; other seller → `forbidden`; inactive seller → `seller_not_active`; `walletId` set → `wallet_already_exists`
- [ ] Read policy: seller reads own wallet; different seller → `forbidden`; admin reads any
- [ ] Update status policy: admin passes; seller → `forbidden`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-wallet-module/prd.md` ← read first
- `tasks/prd-wallet-module/techspec.md` ← read first
- `.cursor/rules/module-wallet.mdc` ← read first
- `src/domain/wallet/types.ts` ← create
- `src/domain/wallet/errors.ts` ← create
- `src/domain/wallet/validators.ts` ← create
- `src/domain/wallet/policies.ts` ← create
- `tests/domain/wallet/validators.test.ts` ← create
- `tests/domain/wallet/policies.test.ts` ← create
