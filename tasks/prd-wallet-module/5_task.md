# Task 5.0: HTTP routes, server wiring, route tests, API docs, and seller cleanup

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Exposes wallet operations via HTTP: register, read (seller-nested and by ID), and admin status update. Wires routes into `server.ts`, documents endpoints in `API.md`, and removes the stale `@todo(wallet-module)` from seller approval — wallet creation is frontend-driven on first login, not on admin approval.

Corresponds to **techspec § Component 6 — HTTP routes**, **§ Component 7 — Seller module cleanup**, and API/E2E test strategy.

Depends on: _1.0, 2.0, 3.0, 4.0_

## Requirements

- FR-4: `POST /v1/sellers/:id/wallet` — seller (own profile only); reject duplicate active wallet on same network
- FR-6: `GET /v1/sellers/:id/wallet` and `GET /v1/wallets/:id` — seller (own) or admin; no `secretEncrypted` in responses
- FR-7: `PATCH /v1/wallets/:id/status` — admin only; body `{ status: "active" | "inactive" }`
- FR-10: route handlers must not log `credentialId` (assert in test with log spy if feasible)
- Techspec: Zod schemas for request bodies; thin handlers delegating to application layer; `mapWalletError` for error codes
- Techspec: remove `@todo(wallet-module)` block from `transitionSellerStatusCommand.ts` — approval only sets `seller.status = 'active'`
- Route tests: full flow (approve → register → GET shows `walletId`), auth failures, validation errors
- Update `API.md` with all four wallet endpoints

## Subtasks

- [ ] 5.1 Read `src/routes/v1/sellers.ts` and an existing route file for Fastify handler, Zod, JWT, and error-mapping patterns
- [ ] 5.2 Create `src/routes/v1/wallets.ts` with all four routes and Zod schemas
- [ ] 5.3 Implement `mapWalletError` (or equivalent) mapping domain error codes to HTTP status codes per techspec
- [ ] 5.4 Register wallet routes in `src/server.ts` (same JWT scope as sellers)
- [ ] 5.5 Add `preHandler: requireRoles("admin")` on PATCH status route
- [ ] 5.6 Remove `@todo(wallet-module)` from `src/application/seller/commands/transitionSellerStatusCommand.ts`
- [ ] 5.7 Update `API.md` with wallet endpoint documentation
- [ ] 5.8 Write route tests `tests/routes/v1/walletRoutes.test.ts` covering register, read, admin PATCH, auth, and validation
- [ ] 5.9 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "6. HTTP routes"** and **§ "7. Seller module cleanup"**.

Route table:

| Method | Path | Actor | Response |
|--------|------|-------|----------|
| POST | `/v1/sellers/:id/wallet` | seller (own) | `201 WalletPublicView` |
| GET | `/v1/sellers/:id/wallet` | seller (own) or admin | `200 WalletPublicView` |
| GET | `/v1/wallets/:id` | seller (own wallet) or admin | `200 WalletPublicView` |
| PATCH | `/v1/wallets/:id/status` | admin | `200 WalletPublicView` |

Zod schemas:

```typescript
const registerWalletBodySchema = z.object({
  contractId: z.string().min(1),
  credentialId: z.string().min(1),
  signerPublicKey: z.string().min(1),
  network: z.enum(["testnet", "mainnet"]),
  createdTxHash: z.string().min(1).optional(),
});

const walletStatusBodySchema = z.object({
  status: z.enum(["active", "inactive"]),
});
```

Seller cleanup — after (no wallet side-effect on approve):

```typescript
await deps.db
  .update(sellers)
  .set({ status: input.targetStatus, updatedAt: new Date() })
  .where(eq(sellers.id, input.sellerId));
```

E2E test scenario from techspec:

1. Admin approves seller → `status = active`, `walletId = null`
2. Seller POST register wallet → `201`
3. GET seller → `walletId` set
4. Non-active seller POST register → `403`

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] All four wallet routes respond with correct status codes and shapes
- [ ] `POST /v1/sellers/:id/wallet` returns `201` with `WalletPublicView` (no `secretEncrypted`)
- [ ] Duplicate registration returns `409 wallet_already_exists`
- [ ] Seller cannot register or read another seller's wallet → `403`
- [ ] Admin can read any wallet and PATCH status
- [ ] Seller PATCH status → `403`
- [ ] `transitionSellerStatusCommand` no longer contains `@todo(wallet-module)`
- [ ] `API.md` documents all wallet endpoints
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-wallet-module/prd.md` ← read first
- `tasks/prd-wallet-module/techspec.md` ← read first
- `.cursor/rules/module-wallet.mdc` ← read first
- `src/routes/v1/wallets.ts` ← create
- `src/server.ts` ← modify
- `src/application/seller/commands/transitionSellerStatusCommand.ts` ← modify
- `API.md` ← modify
- `tests/routes/v1/walletRoutes.test.ts` ← create
