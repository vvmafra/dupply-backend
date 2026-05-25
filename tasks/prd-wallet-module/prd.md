# Product Requirements Document — Seller Wallet Module

## Overview

When a seller is approved by a risk analyst and their status transitions to `active`, they need a Stellar smart account (wallet) to participate in on-chain operations such as issuing and settling receivables. This wallet must be created in a fully blockchain-agnostic way from the seller's perspective — no prior knowledge of Stellar, XLM, or private keys required.

The solution uses WebAuthn passkeys (device biometrics or PIN) as the authentication mechanism. The `smart-account-kit` SDK (frontend) handles wallet creation and signing; the backend is responsible only for persisting the resulting references and exposing them through a clean API. This module establishes the schema, routes, and business rules for the `wallets` table and the `seller.walletId` foreign key.

## Goals

- Enable sellers to create and own a self-custodied Stellar smart account without blockchain knowledge.
- Tie wallet registration to the seller approval flow in a lightweight, non-blocking way.
- Give the backend a reliable reference (`contractId`, `credentialId`) to associate on-chain operations with a seller.
- Keep the implementation simple and focused on the happy path; defer relayer, multi-device recovery, and platform wallet management to future iterations.

**Success metrics:**
- Every seller with `status = 'active'` can successfully register a wallet via the frontend SDK and have it persisted by the backend.
- `seller.walletId` is non-null for every seller who has completed the wallet creation flow.
- The `credentialId` stored in the backend matches the one the frontend SDK used to create the smart account.
- No seller secret or private key is ever stored or logged in the backend.

## User Stories

- As an approved seller, I want to create my wallet on first login so that I can interact with the platform without managing blockchain credentials manually.
- As an approved seller, I want to use my device's biometrics (passkey) to authenticate on-chain operations so that I never need to handle private keys.
- As an admin, I want to view the wallet associated with a seller so that I can verify their on-chain identity and status.
- As the system, I want to detect that a seller does not yet have a wallet so that the frontend can prompt wallet creation at the right moment.

**Main flow:**
1. Risk analyst approves seller → `seller.status` transitions to `active`; `seller.walletId` remains null.
2. Seller logs in for the first time post-approval → frontend detects `walletId == null`.
3. Frontend initialises `SmartAccountKit` and calls `createWallet(appName, userEmail, { autoSubmit: true, autoFund: true })` (testnet only for now).
4. Browser prompts the user to register a passkey (biometrics/PIN via WebAuthn).
5. SDK deploys the Soroban smart account on-chain and returns `{ contractId, credentialId, createdTxHash }`.
6. Frontend calls `POST /v1/sellers/:id/wallet` with the data from step 5.
7. Backend saves the new wallet record and updates `seller.walletId`.
8. Subsequent logins: frontend calls `connectWallet({ credentialId })` to restore the session; no new wallet creation needed.

## Core Features

1. **Wallet registration endpoint**
   - What it does: Receives `{ contractId, credentialId, network, createdTxHash? }` from the frontend after the SDK creates the wallet on-chain, persists it, and links it to the seller via `seller.walletId`.
   - Why it matters: Decouples the on-chain creation (frontend SDK) from the backend record, keeping the server free of blockchain private keys.

2. **Wallet read endpoints**
   - What it does: Exposes `GET /v1/sellers/:id/wallet` and `GET /v1/wallets/:id` for the seller (own wallet only) and admins.
   - Why it matters: Allows the frontend and admin tooling to confirm wallet status and retrieve the `address` (`contractId`) needed for on-chain interactions.

3. **Wallet-not-created detection**
   - What it does: `seller.walletId == null` signals that the wallet has not been created yet. No extra status field.
   - Why it matters: Gives the frontend a single, unambiguous signal to initiate the wallet creation flow on first login.

4. **Testnet auto-funding**
   - What it does: On testnet, the SDK calls Friendbot via `autoFund: true` during `createWallet()` — no backend involvement.
   - Why it matters: Allows testing without XLM balance management; the backend has nothing to do here.

5. **Admin wallet status management**
   - What it does: `PATCH /v1/wallets/:id/status` allows admins to activate or deactivate a wallet.
   - Why it matters: Enables operational control without deleting on-chain data.

## Functional Requirements

1. **FR-1:** The `wallets` table must store `address` (Soroban `C...` contract ID), `credentialId`, `network`, `type`, `parentType`, `sellerId`, `createdTxHash`, `signerPublicKey`, `status`, and standard timestamps (`createdAt`, `updatedAt`, `deletedAt`).
2. **FR-2:** For seller wallets, `type` must be `'smart_account'`, `credentialId` must be non-null, and `secretEncrypted` must be null. Validation must occur at the application layer.
3. **FR-3:** `signerPublicKey` must be provided at registration time. The `smart-account-kit` `createWallet()` returns `publicKey` as a `Uint8Array` (65-byte secp256r1 uncompressed key); the frontend must convert it to a hex string and include it in the registration payload.
4. **FR-4:** `POST /v1/sellers/:id/wallet` must be callable only by the authenticated seller who owns that seller profile. It must reject the request if an active wallet already exists for that seller on the same network.
5. **FR-5:** `POST /v1/sellers/:id/wallet` must atomically create the wallet record and update `seller.walletId` in the same DB transaction.
6. **FR-6:** `GET /v1/sellers/:id/wallet` must be accessible by the seller (own) or an admin. `secretEncrypted` must never appear in any response.
7. **FR-7:** `PATCH /v1/wallets/:id/status` must be restricted to admins and must only accept `'active'` or `'inactive'` as values.
8. **FR-8:** On testnet (`network = 'testnet'`), the backend must not attempt to fund the wallet — Friendbot is handled by the frontend SDK via `autoFund: true`.
9. **FR-9:** `seller.walletId == null` is the canonical signal that a seller has not yet created their wallet. No intermediate seller status is introduced.
10. **FR-10:** `credentialId` must not appear in server logs.
11. **FR-11:** A seller may have at most one `status = 'active'` wallet per network. The application layer must enforce this before insert.

## Technical Constraints

- Scope: backend only (`src/`). Frontend SDK integration is out of scope here.
- New table required: `wallets`. Migration needed.
- `sellers` table requires a new `walletId` nullable FK column pointing to `wallets.id`. Migration needed.
- The backend does not interact with the Stellar network to create or fund wallets — it only persists references received from the frontend.
- No relayer integration in this version.

## Out of Scope

- Relayer / fee sponsoring (platform pays on-chain fees) — future iteration.
- Multi-device passkey recovery (user loses device) — future iteration.
- Platform wallets (`type = 'classic_wallet'`, `parentType = 'platform'`) — future iteration.
- Soft delete activation for wallets — `deletedAt` field exists in schema but is not used in v1.
- Mainnet deployment and mainnet auto-funding strategy.
- Wallet migration between networks.

## Open Questions

~~**OQ-1:** Does `createWallet()` return `signerPublicKey`?~~ — **Resolved.** `CreateWalletResult` includes `publicKey: Uint8Array` (65-byte secp256r1 uncompressed key). Frontend converts to hex and sends in the registration payload. `signerPublicKey` is non-nullable.

~~**OQ-2:** One or multiple wallets per seller per network?~~ — **Resolved.** One active wallet per seller per network (FR-11).

~~**OQ-3:** `relayerUrl` per environment or per seller?~~ — **Resolved.** Per environment — single config value shared across all sellers. Deferred to the relayer iteration.
