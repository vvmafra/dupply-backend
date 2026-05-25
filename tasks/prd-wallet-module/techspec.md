# Tech Spec — Seller Wallet Module

## Overview

Implement the **wallet** bounded context for seller Stellar smart accounts: `wallets` table + migration, FK from `sellers.walletId`, domain invariants for `smart_account` seller wallets, application commands/queries (CQRS), and HTTP routes to register a wallet after frontend SDK creation, read wallet status, and let admins activate/deactivate wallets.

The backend **never** creates, funds, or signs on-chain transactions — it only persists references (`address`, `credentialId`, `signerPublicKey`, etc.) received from the frontend `smart-account-kit` SDK.

**In scope:** schema + migration, domain validation, `POST /v1/sellers/:id/wallet`, `GET /v1/sellers/:id/wallet`, `GET /v1/wallets/:id`, `PATCH /v1/wallets/:id/status`, atomic wallet registration + `seller.walletId` update, remove stale `@todo(wallet-module)` from seller approval command.

**Out of scope (unchanged from PRD):** relayer / fee sponsoring, multi-device passkey recovery, platform wallets (`classic_wallet`), soft-delete routes, mainnet auto-funding, wallet migration between networks, Stellar RPC calls, `RELAYER_URL` config.

Reference: [`tasks/prd-wallet-module/prd.md`](prd.md), [`.cursor/rules/module-wallet.mdc`](../../.cursor/rules/module-wallet.mdc).

**FR traceability:** FR-1–FR-11 covered in components below.

---

## Architecture overview

Introduce a **`wallet`** bounded context mirroring seller/account module layout (`docs/ARCHITECTURE-RULES.md` §9.1). No `integrations/stellar` changes — wallet registration is pure persistence.

```
Domain (wallet/)
  ├── types.ts       — WalletStatus, WalletNetwork, WalletType, WalletPublicView
  ├── errors.ts      — WalletError codes
  ├── policies.ts    — authorization (seller own | admin)
  └── validators.ts  — smart_account invariants, address/network format

Application (wallet/)
  ├── commands/
  │   ├── registerSellerWalletCommand.ts   — atomic INSERT wallet + UPDATE seller.walletId
  │   └── updateWalletStatusCommand.ts     — admin activate/deactivate
  └── queries/
      ├── getWalletByIdQuery.ts
      └── getSellerWalletQuery.ts

Infrastructure
  ├── db/schema.{ts,pg.ts}     — wallets table; sellers.walletId FK
  └── drizzle/0007_wallets.sql — migration

HTTP (routes/)
  └── v1/wallets.ts            — all wallet routes (including seller-nested paths)
```

```
Frontend SDK createWallet()
  → POST /v1/sellers/:id/wallet { contractId, credentialId, signerPublicKey, network, createdTxHash? }
      → assertCanRegisterSellerWallet (seller active, actor owns seller, no duplicate active wallet)
      → assertValidSellerSmartAccountWallet (domain invariants)
      → db.transaction: INSERT wallets + UPDATE sellers.walletId
  → 201 WalletPublicView

Subsequent login
  → GET /v1/sellers/:id  (existing) — walletId != null → skip creation flow
  → GET /v1/sellers/:id/wallet — returns WalletPublicView (no secretEncrypted)
```

---

## Component design

### 1. Database schema — `wallets` table + `sellers.walletId` FK

**Files:** `src/db/schema.ts`, `src/db/schema.pg.ts`, `src/db/schema.runtime.ts`, `drizzle/0007_wallets.sql`

Add `wallets` per `module-wallet.mdc`. Add FK constraint on existing `sellers.wallet_id` column (nullable until registration).

```typescript
// After — src/db/schema.pg.ts (Postgres canonical; mirror in schema.ts)

export const WALLET_STATUSES = ["active", "inactive"] as const;
export const WALLET_NETWORKS = ["testnet", "mainnet"] as const;
export const WALLET_TYPES = ["smart_account", "classic_wallet"] as const;
export const WALLET_PARENT_TYPES = ["seller", "platform"] as const;

export const wallets = pgTable(
  "wallets",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("active"),
    network: text("network").notNull(),
    address: text("address").notNull(),
    type: text("type").notNull(),
    credentialId: text("credential_id"),
    secretEncrypted: text("secret_encrypted"),
    signerPublicKey: text("signer_public_key").notNull(),
    createdTxHash: text("created_tx_hash"),
    parentType: text("parent_type").notNull(),
    sellerId: text("seller_id").references(() => sellers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("wallets_status_check", sql`${t.status} IN ('active', 'inactive')`),
    check("wallets_network_check", sql`${t.network} IN ('testnet', 'mainnet')`),
    check(
      "wallets_type_check",
      sql`${t.type} IN ('smart_account', 'classic_wallet')`,
    ),
    check(
      "wallets_parent_type_check",
      sql`${t.parentType} IN ('seller', 'platform')`,
    ),
    index("wallets_seller_id_idx").on(t.sellerId),
    index("wallets_address_network_idx").on(t.address, t.network),
    // FR-11: at most one active seller wallet per network
    uniqueIndex("wallets_seller_network_active_unique")
      .on(t.sellerId, t.network)
      .where(
        sql`${t.status} = 'active' AND ${t.parentType} = 'seller' AND ${t.deletedAt} IS NULL`,
      ),
  ],
);

// Modify sellers — add FK (column already exists as nullable text)
// In Drizzle: .references(() => wallets.id) on sellers.walletId
```

**Migration `drizzle/0007_wallets.sql`:**

1. `CREATE TABLE wallets (...)` with checks and indexes.
2. `ALTER TABLE sellers ADD CONSTRAINT sellers_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES wallets(id);`  
   *(Safe: no existing wallet_id values in production data.)*

**`schema.runtime.ts`:** export `wallets`.

**FR coverage:** FR-1, FR-11.

---

### 2. Domain — types, validators, policies, errors

**Files:** `src/domain/wallet/types.ts`, `errors.ts`, `validators.ts`, `policies.ts`

```typescript
// src/domain/wallet/types.ts
export const WALLET_STATUSES = ["active", "inactive"] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

export const WALLET_NETWORKS = ["testnet", "mainnet"] as const;
export type WalletNetwork = (typeof WALLET_NETWORKS)[number];

export type WalletPublicView = {
  id: string;
  status: WalletStatus;
  network: WalletNetwork;
  address: string;
  type: "smart_account";
  credentialId: string;
  signerPublicKey: string;
  createdTxHash: string | null;
  parentType: "seller";
  sellerId: string;
  createdAt: Date;
  updatedAt: Date;
};
// secretEncrypted intentionally omitted from public view (FR-6)
```

```typescript
// src/domain/wallet/validators.ts — pure functions, no I/O

/** Soroban contract IDs start with 'C' and are 56 chars (Stellar strkey). */
const SOROBAN_CONTRACT_ID = /^C[A-Z2-7]{55}$/;

/** 65-byte secp256r1 uncompressed public key as 130-char hex (0x04 prefix optional). */
const SIGNER_PUBLIC_KEY_HEX = /^(0x)?[0-9a-fA-F]{128,130}$/;

export type RegisterSellerWalletPayload = {
  contractId: string;
  credentialId: string;
  signerPublicKey: string;
  network: WalletNetwork;
  createdTxHash?: string;
};

export function assertValidSellerSmartAccountWallet(
  input: RegisterSellerWalletPayload,
): void {
  if (!SOROBAN_CONTRACT_ID.test(input.contractId)) {
    throw new WalletError(WALLET_ERROR_CODES.VALIDATION_ERROR);
  }
  if (!input.credentialId.trim()) {
    throw new WalletError(WALLET_ERROR_CODES.VALIDATION_ERROR);
  }
  if (!SIGNER_PUBLIC_KEY_HEX.test(input.signerPublicKey)) {
    throw new WalletError(WALLET_ERROR_CODES.VALIDATION_ERROR);
  }
  if (!WALLET_NETWORKS.includes(input.network)) {
    throw new WalletError(WALLET_ERROR_CODES.VALIDATION_ERROR);
  }
}
```

Domain invariants enforced at insert (FR-2) — command sets fixed values, validator asserts payload:

| Field | Seller smart_account value |
|-------|---------------------------|
| `type` | `'smart_account'` |
| `parentType` | `'seller'` |
| `credentialId` | non-null (from payload) |
| `secretEncrypted` | `null` |
| `signerPublicKey` | non-null (from payload) |
| `sellerId` | seller being registered |

```typescript
// src/domain/wallet/policies.ts
export function assertCanRegisterSellerWallet(
  actor: { profileId: string; role: AccountRole },
  seller: { id: string; status: SellerStatus; walletId: string | null; deletedAt: Date | null },
  network: WalletNetwork,
): void {
  if (seller.deletedAt !== null) throw new WalletError(WALLET_ERROR_CODES.SELLER_NOT_FOUND);
  if (actor.profileId !== seller.id) throw new WalletError(WALLET_ERROR_CODES.FORBIDDEN);
  if (seller.status !== "active") throw new WalletError(WALLET_ERROR_CODES.SELLER_NOT_ACTIVE);
  // v1: walletId null means not yet created (FR-9). Block re-registration once linked.
  if (seller.walletId !== null) throw new WalletError(WALLET_ERROR_CODES.WALLET_ALREADY_EXISTS);
}

export function assertCanReadWallet(
  actor: { profileId: string; role: AccountRole },
  wallet: { id: string; sellerId: string | null; parentType: string },
): void {
  if (actor.role === "admin") return;
  if (wallet.parentType === "seller" && wallet.sellerId === actor.profileId) return;
  throw new WalletError(WALLET_ERROR_CODES.FORBIDDEN);
}

export function assertCanUpdateWalletStatus(actor: { role: AccountRole }): void {
  if (actor.role !== "admin") throw new WalletError(WALLET_ERROR_CODES.FORBIDDEN);
}
```

**Error codes (`src/domain/wallet/errors.ts`):**

| Code | HTTP | When |
|------|------|------|
| `wallet_not_found` | 404 | Missing wallet |
| `seller_not_found` | 404 | Seller missing or soft-deleted |
| `forbidden` | 403 | Actor lacks permission |
| `seller_not_active` | 403 | Seller not `active` at registration |
| `wallet_already_exists` | 409 | Active wallet already registered (same seller/network or walletId set) |
| `validation_error` | 400 | Invalid contractId, signerPublicKey, or network |
| `invalid_wallet_status` | 400 | PATCH status not `active` \| `inactive` |

**FR coverage:** FR-2, FR-3, FR-4, FR-6, FR-7, FR-9, FR-10, FR-11.

---

### 3. Application — register seller wallet (command)

**File:** `src/application/wallet/commands/registerSellerWalletCommand.ts`

```typescript
import { createId } from "@paralleldrive/cuid2";
import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { sellers, wallets } from "../../../db/schema.runtime.js";
import { assertCanRegisterSellerWallet } from "../../../domain/wallet/policies.js";
import {
  assertValidSellerSmartAccountWallet,
  type RegisterSellerWalletPayload,
} from "../../../domain/wallet/validators.js";
import { WALLET_ERROR_CODES, WalletError } from "../../../domain/wallet/errors.js";
import { loadSellerOrThrow } from "../../seller/sellerHelpers.js";
import { toWalletPublicView } from "../walletHelpers.js";

export type RegisterSellerWalletInput = {
  actor: { profileId: string; role: AccountRole };
  sellerId: string;
  payload: RegisterSellerWalletPayload;
};

export async function executeRegisterSellerWallet(
  deps: AppDeps,
  input: RegisterSellerWalletInput,
): Promise<WalletPublicView> {
  const seller = await loadSellerOrThrow(deps, input.sellerId);
  assertCanRegisterSellerWallet(input.actor, seller, input.payload.network);
  assertValidSellerSmartAccountWallet(input.payload);

  // FR-11: application-layer guard before insert (DB partial unique index is backstop)
  const [existing] = await deps.db
    .select({ id: wallets.id })
    .from(wallets)
    .where(
      and(
        eq(wallets.sellerId, input.sellerId),
        eq(wallets.network, input.payload.network),
        eq(wallets.status, "active"),
        isNull(wallets.deletedAt),
      ),
    )
    .limit(1);
  if (existing) throw new WalletError(WALLET_ERROR_CODES.WALLET_ALREADY_EXISTS);

  const walletId = createId();
  const now = new Date();

  await deps.db.transaction(async (tx) => {
    await tx.insert(wallets).values({
      id: walletId,
      status: "active",
      network: input.payload.network,
      address: input.payload.contractId,
      type: "smart_account",
      credentialId: input.payload.credentialId,
      secretEncrypted: null,
      signerPublicKey: input.payload.signerPublicKey,
      createdTxHash: input.payload.createdTxHash ?? null,
      parentType: "seller",
      sellerId: input.sellerId,
      createdAt: now,
      updatedAt: now,
    });
    await tx
      .update(sellers)
      .set({ walletId, updatedAt: now })
      .where(eq(sellers.id, input.sellerId));
  });

  return toWalletPublicView({
    id: walletId,
    status: "active",
    network: input.payload.network,
    address: input.payload.contractId,
    type: "smart_account",
    credentialId: input.payload.credentialId,
    signerPublicKey: input.payload.signerPublicKey,
    createdTxHash: input.payload.createdTxHash ?? null,
    parentType: "seller",
    sellerId: input.sellerId,
    createdAt: now,
    updatedAt: now,
  });
}
```

**Design decisions:**

- **Seller must be `active`** before registration — wallet creation happens post-approval on first login (PRD main flow).
- **Atomic transaction (FR-5):** wallet row + `seller.walletId` update in one `db.transaction`.
- **No backend funding (FR-8):** command never calls Stellar/Friendbot; `network = 'testnet'` is accepted as payload only.
- **Logging (FR-10):** log `walletId`, `sellerId`, `network`, `address` at `info`. **Never** log `credentialId` or `signerPublicKey`.

**FR coverage:** FR-3, FR-4, FR-5, FR-8, FR-10, FR-11.

---

### 4. Application — update wallet status (command)

**File:** `src/application/wallet/commands/updateWalletStatusCommand.ts`

```typescript
export type UpdateWalletStatusInput = {
  walletId: string;
  status: "active" | "inactive";
  actor: { role: AccountRole };
};

export async function executeUpdateWalletStatus(
  deps: AppDeps,
  input: UpdateWalletStatusInput,
): Promise<WalletPublicView> {
  assertCanUpdateWalletStatus(input.actor);
  const wallet = await loadWalletOrThrow(deps, input.walletId);
  const now = new Date();

  await deps.db
    .update(wallets)
    .set({ status: input.status, updatedAt: now })
    .where(eq(wallets.id, input.walletId));

  return toWalletPublicView({ ...wallet, status: input.status, updatedAt: now });
}
```

Admin-only (FR-7). Reactivating a wallet re-triggers FR-11 uniqueness — if another active wallet exists for same `(sellerId, network)`, DB unique index rejects the update; map to `409 wallet_already_exists`.

**FR coverage:** FR-7.

---

### 5. Application — queries

**Files:** `src/application/wallet/queries/getSellerWalletQuery.ts`, `getWalletByIdQuery.ts`, `src/application/wallet/walletHelpers.ts`

```typescript
// getSellerWalletQuery.ts
export async function executeGetSellerWallet(
  deps: AppDeps,
  input: { actor: JwtActor; sellerId: string },
): Promise<WalletPublicView> {
  const seller = await loadSellerOrThrow(deps, input.sellerId);
  assertCanReadSeller(input.actor, seller); // reuse seller read policy (own | admin)

  if (seller.walletId === null) {
    throw new WalletError(WALLET_ERROR_CODES.WALLET_NOT_FOUND);
  }
  const wallet = await loadWalletOrThrow(deps, seller.walletId);
  assertCanReadWallet(input.actor, wallet);
  return toWalletPublicView(wallet);
}

// getWalletByIdQuery.ts — same assertCanReadWallet after load
```

**`toWalletPublicView`:** maps DB row → `WalletPublicView`; strips `secretEncrypted`. Never include `secretEncrypted` in any response (FR-6).

**Wallet-not-created detection (FR-9):** no dedicated endpoint — frontend reads `walletId` from existing `GET /v1/sellers/:id` (`SellerPublicView.walletId`). `null` → prompt wallet creation.

**FR coverage:** FR-6, FR-9.

---

### 6. HTTP routes

**File:** `src/routes/v1/wallets.ts` (new), `src/server.ts` (register)

| Method | Path | Actor | Body | Response |
|--------|------|-------|------|----------|
| POST | `/v1/sellers/:id/wallet` | seller (own) | `RegisterSellerWalletBody` | `201 WalletPublicView` |
| GET | `/v1/sellers/:id/wallet` | seller (own) or admin | — | `200 WalletPublicView` |
| GET | `/v1/wallets/:id` | seller (own wallet) or admin | — | `200 WalletPublicView` |
| PATCH | `/v1/wallets/:id/status` | admin | `{ status: "active" \| "inactive" }` | `200 WalletPublicView` |

```typescript
// Zod schemas — src/routes/v1/wallets.ts
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

Thin handlers: Zod → application → `mapWalletError`. Register behind existing JWT scope in `server.ts` (same as sellers). PATCH uses `preHandler: requireRoles("admin")`.

**FR coverage:** FR-4, FR-6, FR-7.

---

### 7. Seller module cleanup

**File:** `src/application/seller/commands/transitionSellerStatusCommand.ts`

Remove the `@todo(wallet-module)` block. Wallet is **not** created on admin approval — it is created asynchronously by the seller via frontend SDK on first login (PRD main flow step 1–7). Approval only sets `seller.status = 'active'`; `walletId` stays `null`.

```typescript
// After — no wallet side-effect on approve
await deps.db
  .update(sellers)
  .set({ status: input.targetStatus, updatedAt: new Date() })
  .where(eq(sellers.id, input.sellerId));
```

---

## Data flow

### Wallet registration (first login post-approval)

```
GET /v1/sellers/:id  [Bearer JWT, profileId = sellerId]
  → SellerPublicView { status: "active", walletId: null }
  → Frontend: SDK createWallet() → passkey prompt → on-chain deploy

POST /v1/sellers/:id/wallet  [Bearer JWT]
  → Zod { contractId, credentialId, signerPublicKey, network, createdTxHash? }
  → executeRegisterSellerWallet
      → assertCanRegisterSellerWallet (own seller, active, walletId null)
      → assertValidSellerSmartAccountWallet
      → check no active wallet on (sellerId, network)
      → db.transaction: INSERT wallets + UPDATE sellers.walletId
  → 201 WalletPublicView (no secretEncrypted)
```

### Read wallet

```
GET /v1/sellers/:id/wallet  [Bearer JWT — seller own or admin]
  → load seller → assertCanReadSeller
  → load wallet by seller.walletId → toWalletPublicView
  → 200

GET /v1/wallets/:id  [Bearer JWT — seller own or admin]
  → load wallet → assertCanReadWallet
  → 200 WalletPublicView
```

### Admin deactivate

```
PATCH /v1/wallets/:id/status { status: "inactive" }  [Bearer JWT, role=admin]
  → executeUpdateWalletStatus
  → 200 WalletPublicView
```

---

## Files changed

| File | Change type |
|------|-------------|
| `src/db/schema.ts` | Modified — add `wallets`; FK on `sellers.walletId` |
| `src/db/schema.pg.ts` | Modified — add `wallets`; FK on `sellers.walletId` |
| `src/db/schema.runtime.ts` | Modified — export `wallets` |
| `drizzle/0007_wallets.sql` | Added — migration |
| `src/domain/wallet/types.ts` | Added |
| `src/domain/wallet/errors.ts` | Added |
| `src/domain/wallet/validators.ts` | Added |
| `src/domain/wallet/policies.ts` | Added |
| `tests/domain/wallet/*.test.ts` | Added |
| `src/application/wallet/walletHelpers.ts` | Added |
| `src/application/wallet/commands/registerSellerWalletCommand.ts` | Added |
| `src/application/wallet/commands/updateWalletStatusCommand.ts` | Added |
| `src/application/wallet/queries/getSellerWalletQuery.ts` | Added |
| `src/application/wallet/queries/getWalletByIdQuery.ts` | Added |
| `tests/application/wallet/*.test.ts` | Added |
| `src/routes/v1/wallets.ts` | Added |
| `src/server.ts` | Modified — register wallet routes |
| `src/application/seller/commands/transitionSellerStatusCommand.ts` | Modified — remove @todo |
| `API.md` | Modified — wallet endpoints |
| `tests/routes/v1/walletRoutes.test.ts` | Added |

---

## Impact analysis

- **API compatibility:** **Non-breaking.** Additive routes only. Existing `GET /v1/sellers/:id` already exposes `walletId`; no response shape change.
- **Database:** New `wallets` table; `sellers.wallet_id` gains FK to `wallets.id`. Partial unique index enforces FR-11 at DB level.
- **Performance:** Single-row lookups by PK (`wallets.id`, `sellers.id`). Duplicate check indexed on `(seller_id, network, status)`. No N+1 concerns.
- **Other modules:**
  - **Seller:** `walletId` populated on registration; approval flow unchanged except @todo removal.
  - **Receivables (future):** may require `seller.walletId != null` before on-chain issuance — not in this module's scope.
  - **Platform wallets (future):** schema supports `classic_wallet` / `parentType = platform`; no routes in v1.

---

## Test strategy

### Unit — domain/wallet/validators

| Scenario | Input | Expected |
|----------|-------|----------|
| Valid Soroban address | `C...` 56 chars | passes |
| Invalid address | `G...` or short string | `validation_error` |
| Valid signer hex | 130-char hex | passes |
| Empty credentialId | `""` | `validation_error` |
| Invalid network | `"devnet"` | `validation_error` |

### Unit — domain/wallet/policies

| Scenario | Actor | Seller/Wallet | Expected |
|----------|-------|---------------|----------|
| Register own | seller profileId match | active, walletId null | passes |
| Register other | different seller | active | `forbidden` |
| Register inactive seller | own | status `in_review` | `seller_not_active` |
| Register duplicate | own | walletId already set | `wallet_already_exists` |
| Read own wallet | seller | sellerId match | passes |
| Read other wallet | seller | different sellerId | `forbidden` |
| Admin read | admin | any | passes |
| Admin status PATCH | admin | — | passes |
| Seller status PATCH | seller | — | `forbidden` |

### Integration — register flow

- Active seller with `walletId null` registers wallet → `201`, `seller.walletId` updated atomically.
- Rollback on transaction failure leaves `walletId null` and no wallet row.
- Second POST for same seller/network → `409 wallet_already_exists`.
- DB partial unique index rejects concurrent duplicate inserts.
- `secretEncrypted` never returned in response body.

### Integration — read + admin

- Seller GET own wallet via `/v1/sellers/:id/wallet` and `/v1/wallets/:id`.
- Admin GET any seller wallet.
- Seller with `walletId null` → GET `/v1/sellers/:id/wallet` → `404 wallet_not_found`.
- Admin PATCH deactivate → status `inactive`; reactivate → `active`.

### API / E2E

- Full flow: admin approve seller → seller login → POST register wallet → GET seller shows `walletId` set.
- Non-active seller cannot register wallet → `403`.
- `credentialId` absent from server logs (assert in test with log capture or spy).

---

## Observability

- **Logs:** Log `walletId`, `sellerId`, `network`, `address` at `info` on registration and status change. Log `actorRole` on admin status PATCH. **Never** log `credentialId`, `signerPublicKey`, or `secretEncrypted` (FR-10).
- **Error handling:** Wallet errors surface as `{ error: "<code>" }`. DB unique violation on `(seller_id, network)` → map to `409 wallet_already_exists`. Unexpected errors → Fastify 500.
- **Metrics:** none required in v1.

---

## Open questions resolved

| Question (from PRD / rules) | Decision |
|-----------------------------|----------|
| OQ-1: Does `createWallet()` return `signerPublicKey`? | **Yes.** `publicKey: Uint8Array` (65-byte secp256r1). Frontend converts to hex; backend stores in `signerPublicKey` (FR-3). |
| OQ-2: One or multiple wallets per seller per network? | **One active wallet per seller per network** (FR-11). Enforced by partial unique index + application check. |
| OQ-3: `relayerUrl` per environment or per seller? | **Per environment.** Deferred — no `RELAYER_URL` in this module. |
| Seller techspec OQ-2: Approval + wallet creation atomic? | **No.** Wallet creation is **frontend-driven on first login**, not on admin approval. Remove `@todo(wallet-module)` from `transitionSellerStatusCommand`. |
| `seller.walletId` vs multi-network | **v1 is testnet-focused.** `seller.walletId` points to the seller's registered wallet. `walletId == null` is the canonical "not created" signal (FR-9). Multi-network support uses separate `wallets` rows with FR-11 constraint; `seller.walletId` tracks the wallet registered for the current deployment. Full multi-network UX deferred until mainnet launch. |
| Platform wallets in schema | **Schema-ready, routes out of scope.** `classic_wallet` / `parentType = platform` columns exist for future iteration; v1 commands only create seller `smart_account` wallets. |
| Soft delete (`deletedAt`) | **Not used in v1.** Wallets deactivated via `status = inactive` only (PRD out of scope). |
| Stellar integration folder | **No changes.** Backend does not call Stellar RPC for wallet creation or funding (FR-8). |
