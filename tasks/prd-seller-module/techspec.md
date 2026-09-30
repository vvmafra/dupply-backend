# Tech Spec — Seller Module

## Overview

Implement the **seller** (cedente) bounded context: `sellers` table and migration, public seller registration via `POST /v1/auth/register` (atomic account + seller creation), seller profile CRUD (read, metadata update, submit-for-review, admin/risk-analyst status transitions, soft delete), domain validation for JSON metadata, status machine enforcement, real `profileId` in JWT for seller accounts, and the `active`-only guard on receivable creation.

**Not in scope:** document upload (future documents module), wallet creation/linking on approval (wallet module — `walletId` stays nullable; approval command leaves a `@todo` hook), `risk_analyst` role authentication beyond route-level guards (only `admin` performs review transitions until the risk-analyst module lands), email/push notifications on status change (deferred TODO), frontend onboarding UI, receivable logic beyond the seller-status guard, admin listing of soft-deleted sellers (default: exclude `deletedAt IS NOT NULL` from all queries).

Reference: [`tasks/prd-seller-module/prd.md`](prd.md), [`.cursor/rules/module-seller.mdc`](../../.cursor/rules/module-seller.mdc), [`.cursor/rules/money.mdc`](../../.cursor/rules/money.mdc).

**FR traceability:** FR-1–FR-18 covered in components below; FR-18 explicitly deferred (no notification infra).

---

## Architecture overview

Introduce a **`seller`** bounded context mirroring the account module layout (`docs/ARCHITECTURE-RULES.md` §9.1). Registration stays on the auth route but delegates seller creation to the seller application layer inside a shared DB transaction.

```
Domain (seller/)
  ├── types.ts           — SellerStatus, JSON metadata types, SellerPublicView
  ├── errors.ts          — SellerError codes
  ├── policies.ts        — authorization (self | admin | risk_analyst-in_review)
  ├── transitions.ts     — allowed status transitions + actor guards
  └── validators.ts      — pure metadata validation (CNPJ, CPF, phone, money, counts)

Application (seller/)
  ├── commands/
  │   ├── registerSellerCommand.ts      — called from auth/register (account + seller tx)
  │   ├── updateSellerMetadataCommand.ts
  │   ├── submitSellerForReviewCommand.ts
  │   ├── transitionSellerStatusCommand.ts  — approve/reject/deactivate/reactivate
  │   └── softDeleteSellerCommand.ts
  └── queries/
      ├── getSellerQuery.ts
      └── listSellersQuery.ts           — admin + risk_analyst; filter by status

Infrastructure
  ├── db/schema.{ts,pg.ts}  — sellers table (+ nullable walletId without FK until wallet module)
  └── shared/money.ts       — toCents / toReais (global convention; first consumer)

HTTP (routes/)
  ├── v1/auth.ts            — add POST /v1/auth/register (seller role v1)
  └── v1/sellers.ts         — GET /:id, GET / (list), PATCH /:id, POST /:id/submit, PATCH /:id/status, DELETE /:id
```

**Status machine (normative — PRD overrides module-seller.mdc “inactive is terminal”):**

```
created     → in_review   (seller — submit)
in_review   → active      (admin | risk_analyst — approve)
in_review   → inactive    (admin | risk_analyst — reject)
active      → inactive    (admin — deactivate)
inactive    → active      (admin — reactivate)
```

---

## Component design

### 1. Database schema — `sellers` table

**Files:** `src/db/schema.ts`, `src/db/schema.pg.ts`, `src/db/schema.runtime.ts`, new Drizzle migration

Add `sellers` per `module-seller.mdc`. JSON metadata columns stored as `text` (consistent with existing `receivableMd` pattern). **`walletId` is nullable `text` without FK constraint in this migration** — the `wallets` table does not exist yet; add FK when the wallet module lands.

```typescript
// After — src/db/schema.pg.ts (Postgres canonical; mirror in schema.ts)
export const SELLER_STATUSES = ["created", "in_review", "active", "inactive"] as const;

export const sellers = pgTable(
  "sellers",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("created"),
    name: text("name").notNull(),
    companyMetaData: text("company_meta_data").notNull(),
    legalRepresentativeMetaData: text("legal_representative_meta_data").notNull(),
    businessRelationsMetaData: text("business_relations_meta_data").notNull(),
    accountId: text("account_id")
      .notNull()
      .unique()
      .references(() => accounts.id),
    walletId: text("wallet_id"), // nullable; FK deferred to wallet module
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "sellers_status_check",
      sql`${t.status} IN ('created', 'in_review', 'active', 'inactive')`,
    ),
    index("sellers_status_idx").on(t.status),
    index("sellers_account_id_idx").on(t.accountId),
  ],
);
```

**Initial JSON defaults at registration (FR-1):**

```typescript
export const EMPTY_COMPANY_METADATA = {} as const;
export const EMPTY_LEGAL_REP_METADATA = {} as const;
export const EMPTY_BUSINESS_RELATIONS_METADATA = JSON.stringify({ clients: [], suppliers: [] });
```

Persist empty shells; full validation runs only on `submit-for-review` (FR-10).

**Migration:** single file `drizzle/0005_sellers.sql` — `CREATE TABLE sellers (...)` with indexes and check constraint.

**FR coverage:** FR-1, FR-2, FR-17.

---

### 2. Shared money utility

**File:** `src/shared/money.ts` (new)

Implement the global convention from `money.mdc`. Contrato fechado:

| Camada | Formato | Exemplo |
|--------|---------|---------|
| API input (front-end → servidor) | reais, 2 casas decimais | `150000.00` |
| Storage (banco / JSON interno) | centavos, inteiro | `15000000` |
| API output (servidor → front-end) | reais, 2 casas decimais | `150000.00` |

```typescript
/** Converts reais (front-end input, 2 decimal places) → cents (storage integer). */
export const toCents = (reais: number): number => Math.round(reais * 100);

/** Converts cents (storage integer) → reais with 2 decimal places (front-end output). */
export const toReais = (cents: number): number => Math.round(cents) / 100;
```

**Where the conversion happens — seller metadata:**

- `PATCH /v1/sellers/:id` (input): `toCents(body.companyMetaData.shareCapital)` and `toCents(body.companyMetaData.annualRevenue)` before persisting the JSON blob.
- `GET /v1/sellers/:id` and `GET /v1/sellers` (output): parse stored JSON, apply `toReais` on both fields before building `SellerPublicView`.

**Zod validation at HTTP edge:**

```typescript
shareCapital: z.number().nonnegative().multipleOf(0.01),
annualRevenue: z.number().nonnegative().multipleOf(0.01),
```

**FR-5 resolution:** PRD FR-5 originally said "API accepts and returns values in cents." This spec **overrides** that with the platform-wide `money.mdc` convention (API in reais, DB in cents). The front-end contract is `150000.00`, not `15000000`. Update `API.md` accordingly.

**FR coverage:** FR-5.

---

### 3. Domain — types, validators, transitions, policies

**Files:** `src/domain/seller/types.ts`, `errors.ts`, `validators.ts`, `transitions.ts`, `policies.ts`

```typescript
// src/domain/seller/types.ts
export const SELLER_STATUSES = ["created", "in_review", "active", "inactive"] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

export type CompanyMetaData = {
  legalName: string;
  cnpj: string;
  foundingDate: string;
  shareCapital: number;   // cents internally after mapping
  annualRevenue: number;  // cents internally
  corporateEmail: string;
  phone: string;
  businessDescription: string;
  address: {
    zipCode: string;
    state: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
  };
};

export type LegalRepresentativeMetaData = {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  role: string;
};

export type BusinessRelation = {
  legalName: string;
  cnpj: string;
  sharePercentage?: number;
};

export type BusinessRelationsMetaData = {
  clients: BusinessRelation[];
  suppliers: BusinessRelation[];
};

export type SellerPublicView = {
  id: string;
  status: SellerStatus;
  name: string;
  companyMetaData: CompanyMetaData;
  legalRepresentativeMetaData: LegalRepresentativeMetaData;
  businessRelationsMetaData: BusinessRelationsMetaData;
  accountId: string;
  walletId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
```

```typescript
// src/domain/seller/validators.ts — pure functions, no I/O
const DIGITS_ONLY = /^\d+$/;

export function assertValidCnpj(cnpj: string): void { /* exactly 14 digits */ }
export function assertValidCpf(cpf: string): void { /* exactly 11 digits */ }
export function assertValidPhone(phone: string): void { /* digits only, min length */ }
export function assertValidFoundingDate(date: string): void { /* YYYY-MM-DD */ }
export function assertValidAddress(address: CompanyMetaData["address"]): void { /* zip 8, UF 2 */ }

export function assertValidBusinessRelations(data: BusinessRelationsMetaData): void {
  if (data.clients.length < 1 || data.clients.length > 5) throw …;
  if (data.suppliers.length < 1 || data.suppliers.length > 5) throw …;
  for (const rel of [...data.clients, ...data.suppliers]) assertValidCnpj(rel.cnpj);
}

export function assertCompleteSellerMetadata(
  company: CompanyMetaData,
  legal: LegalRepresentativeMetaData,
  relations: BusinessRelationsMetaData,
): void {
  // all required scalar fields present + validators above
}
```

```typescript
// src/domain/seller/transitions.ts
export type StatusTransitionActor =
  | { kind: "seller"; accountId: string }
  | { kind: "reviewer"; role: "admin" | "risk_analyst" }
  | { kind: "admin" };

export function assertSellerStatusTransition(
  from: SellerStatus,
  to: SellerStatus,
  actor: StatusTransitionActor,
): void {
  // created → in_review: seller (own account)
  // in_review → active|inactive: admin | risk_analyst (v1: admin only enforced in route pre-check)
  // active → inactive: admin
  // inactive → active: admin
  // all other pairs → SellerError(invalid_status_transition)
}
```

```typescript
// src/domain/seller/policies.ts
export function assertCanReadSeller(
  actor: { sub: string; role: AccountRole; profileId: string },
  seller: { id: string; accountId: string; status: SellerStatus; deletedAt: Date | null },
): void {
  if (seller.deletedAt !== null) throw new SellerError(SELLER_ERROR_CODES.NOT_FOUND);
  if (actor.profileId === seller.id || actor.role === "admin") return;
  if (actor.role === "risk_analyst" && seller.status === "in_review") return;
  throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
}

export function assertCanUpdateSellerMetadata(
  actor: { profileId: string },
  seller: { id: string; status: SellerStatus },
): void {
  if (actor.profileId !== seller.id) throw …FORBIDDEN;
  if (seller.status !== "created") throw …METADATA_LOCKED;
}

export function assertCanSubmitForReview(
  actor: { profileId: string },
  seller: { id: string; status: SellerStatus },
): void {
  if (actor.profileId !== seller.id) throw …FORBIDDEN;
  if (seller.status !== "created") throw …INVALID_STATUS_FOR_SUBMIT;
}

export function assertCanTransitionSellerStatus(actor: { role: AccountRole }): void {
  // v1: admin only; risk_analyst branch ready but returns FORBIDDEN until module lands
}

export function assertCanSoftDeleteSeller(actor: { role: AccountRole }): void {
  if (actor.role !== "admin") throw …FORBIDDEN;
}

export function assertSellerCanCreateReceivable(seller: { status: SellerStatus; deletedAt: Date | null }): void {
  if (seller.deletedAt !== null || seller.status !== "active") {
    throw new SellerError(SELLER_ERROR_CODES.NOT_ACTIVE);
  }
}
```

**Error codes (`src/domain/seller/errors.ts`):**

| Code | HTTP | When |
|------|------|------|
| `seller_not_found` | 404 | Missing or soft-deleted (non-admin views) |
| `forbidden` | 403 | Actor lacks permission |
| `metadata_locked` | 409 | PATCH metadata outside `created` |
| `validation_error` | 400 | Metadata field invalid |
| `incomplete_metadata` | 400 | Submit with missing required fields |
| `invalid_status_transition` | 409 | Illegal status change |
| `invalid_status_for_submit` | 409 | Submit when not `created` |
| `seller_not_active` | 403 | Receivable guard |

**FR coverage:** FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16.

---

### 4. Application — register (account + seller transaction)

**Files:** `src/application/seller/commands/registerSellerCommand.ts`, `src/application/account/commands/accountAuthDb.ts` (reuse tx pattern)

Add `POST /v1/auth/register` handler that calls `executeRegisterSeller` when `role = "seller"`. Other roles (`risk_analyst`, `admin`) remain **out of scope** for v1 register — return `400 unsupported_role` unless product expands scope; only seller self-registration is required by this PRD.

```typescript
// src/application/seller/commands/registerSellerCommand.ts
import { createId } from "@paralleldrive/cuid2";
import argon2 from "argon2";

export type RegisterSellerInput = {
  email: string;
  password: string;
  name: string; // display name / nome fantasia
};

export type RegisterSellerResult = LoginResult; // auto-login after register (optional — see decision below)

export async function executeRegisterSeller(
  deps: AppDeps,
  input: RegisterSellerInput,
): Promise<{ accountId: string; sellerId: string }> {
  const accountId = createId();
  const sellerId = createId();
  const passwordHash = await argon2.hash(input.password);
  const emptyCompany = JSON.stringify({});
  const emptyLegal = JSON.stringify({});
  const emptyRelations = JSON.stringify({ clients: [], suppliers: [] });

  await deps.db.transaction(async (tx) => {
    await tx.insert(accounts).values({
      id: accountId,
      email: input.email,
      passwordHash,
      role: "seller",
      status: "active", // account active; seller gating is on seller.status
    });
    await tx.insert(sellers).values({
      id: sellerId,
      name: input.name,
      status: "created",
      accountId,
      companyMetaData: emptyCompany,
      legalRepresentativeMetaData: emptyLegal,
      businessRelationsMetaData: emptyRelations,
      walletId: null,
    });
  });

  return { accountId, sellerId };
}
```

**Design decisions:**

- **Account `status = active` at registration** — login works immediately; receivable submission gated by `seller.status = active` (FR-14). Aligns with account module (seller onboarding gate is on seller entity, not account).
- **Register response:** return `201` with `{ accountId, sellerId }` plus tokens (same shape as login) so the frontend can proceed to onboarding without a second login call. `profileId` in JWT = `sellerId`.
- **Duplicate email:** rely on DB unique constraint → map to `409 email_already_exists`.

Replace `mockProfileId` for sellers:

```typescript
// src/domain/account/profileId.ts — extend
export async function resolveProfileId(
  deps: AppDeps,
  accountId: string,
  role: AccountRole,
): Promise<string> {
  if (role === "seller") {
    const [row] = await deps.db.select({ id: sellers.id }).from(sellers)
      .where(and(eq(sellers.accountId, accountId), isNull(sellers.deletedAt)))
      .limit(1);
    if (!row) throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    return row.id;
  }
  return mockProfileId(accountId, role); // risk_analyst / admin until their modules land
}
```

Update `loginCommands.ts` and `refreshCommands.ts` to call `resolveProfileId`.

**FR coverage:** FR-1, FR-2.

---

### 5. Application — metadata update and submit

**Files:** `src/application/seller/commands/updateSellerMetadataCommand.ts`, `submitSellerForReviewCommand.ts`

**Update (FR-3):** partial PATCH allowed while `status = created`. Accept optional sections:

```typescript
export type UpdateSellerMetadataInput = {
  name?: string;
  companyMetaData?: Partial<CompanyMetaData>; // API reais for money fields
  legalRepresentativeMetaData?: Partial<LegalRepresentativeMetaData>;
  businessRelationsMetaData?: Partial<BusinessRelationsMetaData>;
};
```

Flow: load seller → `assertCanUpdateSellerMetadata` → merge JSON → validate touched fields (not full completeness) → `toCents` on money fields → persist → bump `updatedAt`.

**Submit (FR-10):**

```typescript
export async function executeSubmitSellerForReview(
  deps: AppDeps,
  actor: { profileId: string },
  sellerId: string,
): Promise<void> {
  const seller = await loadSellerOrThrow(deps, sellerId);
  assertCanSubmitForReview(actor, seller);
  const company = parseJson<CompanyMetaData>(seller.companyMetaData);
  const legal = parseJson<LegalRepresentativeMetaData>(seller.legalRepresentativeMetaData);
  const relations = parseJson<BusinessRelationsMetaData>(seller.businessRelationsMetaData);
  assertCompleteSellerMetadata(company, legal, relations);
  assertSellerStatusTransition(seller.status, "in_review", { kind: "seller", accountId: seller.accountId });
  await deps.db.update(sellers)
    .set({ status: "in_review", updatedAt: new Date() })
    .where(eq(sellers.id, sellerId));
}
```

Document upload (Step 5) is **not** validated in v1 submit — PRD explicitly out of scope. When documents module lands, extend `assertCompleteSellerMetadata` or add a separate guard.

**FR coverage:** FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10.

---

### 6. Application — status transitions and soft delete

**File:** `src/application/seller/commands/transitionSellerStatusCommand.ts`, `softDeleteSellerCommand.ts`

```typescript
export type TransitionSellerStatusInput = {
  sellerId: string;
  targetStatus: "active" | "inactive";
  actor: { role: AccountRole };
};

export async function executeTransitionSellerStatus(
  deps: AppDeps,
  input: TransitionSellerStatusInput,
): Promise<void> {
  assertCanTransitionSellerStatus(input.actor);
  const seller = await loadSellerOrThrow(deps, input.sellerId);
  const from = seller.status as SellerStatus;
  const actorKind =
    from === "in_review"
      ? { kind: "reviewer" as const, role: input.actor.role as "admin" | "risk_analyst" }
      : { kind: "admin" as const };
  assertSellerStatusTransition(from, input.targetStatus, actorKind);

  await deps.db.transaction(async (tx) => {
    await tx.update(sellers)
      .set({ status: input.targetStatus, updatedAt: new Date() })
      .where(eq(sellers.id, input.sellerId));

    if (from === "in_review" && input.targetStatus === "active") {
      // @todo(wallet-module): create wallet and SET wallet_id = <walletId>
      // Leave walletId null in this module's delivery.
    }
  });
}
```

**Soft delete (FR-15):**

```typescript
export async function executeSoftDeleteSeller(
  deps: AppDeps,
  actor: { role: AccountRole },
  sellerId: string,
): Promise<void> {
  assertCanSoftDeleteSeller(actor);
  const now = new Date();
  await deps.db.update(sellers)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(sellers.id, sellerId), isNull(sellers.deletedAt)));
}
```

**FR coverage:** FR-11, FR-12, FR-13, FR-15, FR-17.

---

### 7. Application — queries

**Files:** `src/application/seller/queries/getSellerQuery.ts`, `listSellersQuery.ts`

**Get (FR-16):** map DB row → `SellerPublicView`; apply `toReais` on monetary fields; `assertCanReadSeller`.

**List (FR-16 — risk_analyst review queue):**

```typescript
export type ListSellersInput = {
  actor: { role: AccountRole };
  status?: SellerStatus;
};

export async function executeListSellers(deps: AppDeps, input: ListSellersInput): Promise<SellerPublicView[]> {
  if (input.actor.role === "risk_analyst") {
    // v1: only in_review; ignore other filters
    input.status = "in_review";
  } else if (input.actor.role !== "admin") {
    throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
  }
  // WHERE deleted_at IS NULL AND (status = :status if provided)
  // ORDER BY updated_at DESC
}
```

Default: exclude soft-deleted rows (OQ-4 decision — see Open questions resolved).

**FR coverage:** FR-16.

---

### 8. HTTP routes

**Files:** `src/routes/v1/auth.ts`, `src/routes/v1/sellers.ts` (new), `src/server.ts`

**Auth — add register:**

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/v1/auth/register` | — | `{ email, password, name, role: "seller" }` | `201` login shape + `{ sellerId }` |

Zod: enforce `role` enum with only `"seller"` accepted in v1.

**Seller routes — new `src/routes/v1/sellers.ts`:**

| Method | Path | Actor | Body | Response |
|--------|------|-------|------|----------|
| GET | `/v1/sellers` | admin; risk_analyst (`in_review` only) | `?status=` | `SellerPublicView[]` |
| GET | `/v1/sellers/:id` | seller (own), admin, risk_analyst (if `in_review`) | — | `SellerPublicView` |
| PATCH | `/v1/sellers/:id` | seller (own) | partial metadata | `SellerPublicView` |
| POST | `/v1/sellers/:id/submit` | seller (own) | — | `204` |
| PATCH | `/v1/sellers/:id/status` | admin (v1); risk_analyst (future) | `{ status: "active" \| "inactive" }` | `204` |
| DELETE | `/v1/sellers/:id` | admin | — | `204` |

Thin handlers: Zod → application → `mapSellerError`. Register seller routes in `server.ts` behind `requireJwt` (except register itself).

**FR coverage:** FR-1, FR-3, FR-10, FR-11, FR-12, FR-13, FR-15, FR-16.

---

### 9. Receivable guard integration

**File:** `src/application/receivable/commands/receivableCommands.ts`

Replace account-only seller validation with seller profile lookup:

```typescript
// executeCreateReceivable — after
const [seller] = await db
  .select()
  .from(sellers)
  .innerJoin(accounts, eq(sellers.accountId, accounts.id))
  .where(
    and(
      eq(accounts.id, input.sellerUserId),
      eq(accounts.role, "seller"),
      isNull(accounts.deletedAt),
      isNull(sellers.deletedAt),
    ),
  )
  .limit(1);

if (!seller) throw new Error("invalid_seller");
assertSellerCanCreateReceivable(seller.sellers);
```

Map `seller_not_active` to HTTP 403 in receivable route error mapper.

**FR coverage:** FR-14, FR-15.

---

## Data flow

### Register + onboarding

```
POST /v1/auth/register { email, password, name, role: "seller" }
  → Zod validation
  → executeRegisterSeller (db.transaction: INSERT accounts + sellers)
  → resolveProfileId → signAccessToken({ profileId: sellerId })
  → 201 { accessToken, refreshToken, sellerId, ... }

PATCH /v1/sellers/:id  [Bearer JWT, profileId = sellerId]
  → assertCanUpdateSellerMetadata (status must be created)
  → merge + validate touched fields + toCents(money)
  → UPDATE sellers SET metadata, updated_at
  → 200 SellerPublicView (toReais on money fields)

POST /v1/sellers/:id/submit  [Bearer JWT]
  → assertCanSubmitForReview
  → assertCompleteSellerMetadata
  → assertSellerStatusTransition(created → in_review)
  → UPDATE status = in_review
  → 204
```

### Admin review

```
GET /v1/sellers?status=in_review  [Bearer JWT, role=admin]
  → executeListSellers
  → 200 SellerPublicView[]

PATCH /v1/sellers/:id/status { status: "active" }  [Bearer JWT, role=admin]
  → assertCanTransitionSellerStatus
  → assertSellerStatusTransition(in_review → active)
  → UPDATE status (+ @todo wallet link)
  → 204
```

### Receivable guard

```
POST /v1/receivables  [Bearer JWT, role=seller]
  → executeCreateReceivable
      → load seller by accountId
      → assertSellerCanCreateReceivable (status=active, not deleted)
      → INSERT receivable
  → 201
```

---

## Files changed

| File | Change type |
|------|-------------|
| `src/db/schema.ts` | Modified — add `sellers` |
| `src/db/schema.pg.ts` | Modified — add `sellers` |
| `src/db/schema.runtime.ts` | Modified — export `sellers` |
| `drizzle/0005_sellers.sql` | Added — migration |
| `src/shared/money.ts` | Added |
| `src/domain/seller/types.ts` | Added |
| `src/domain/seller/errors.ts` | Added |
| `src/domain/seller/validators.ts` | Added |
| `src/domain/seller/transitions.ts` | Added |
| `src/domain/seller/policies.ts` | Added |
| `tests/domain/seller/*.test.ts` | Added |
| `src/application/seller/commands/registerSellerCommand.ts` | Added |
| `src/application/seller/commands/updateSellerMetadataCommand.ts` | Added |
| `src/application/seller/commands/submitSellerForReviewCommand.ts` | Added |
| `src/application/seller/commands/transitionSellerStatusCommand.ts` | Added |
| `src/application/seller/commands/softDeleteSellerCommand.ts` | Added |
| `src/application/seller/queries/getSellerQuery.ts` | Added |
| `src/application/seller/queries/listSellersQuery.ts` | Added |
| `tests/application/seller/*.test.ts` | Added |
| `src/routes/v1/sellers.ts` | Added |
| `src/routes/v1/auth.ts` | Modified — add register |
| `src/server.ts` | Modified — register seller routes |
| `src/domain/account/profileId.ts` | Modified — `resolveProfileId` for sellers |
| `src/application/account/commands/loginCommands.ts` | Modified — real profileId |
| `src/application/account/commands/refreshCommands.ts` | Modified — real profileId |
| `src/application/receivable/commands/receivableCommands.ts` | Modified — seller status guard |
| `src/routes/v1/receivables.ts` | Modified — map seller_not_active |
| `API.md` | Modified — register + seller endpoints, money convention |
| `tests/routes/v1/sellerRoutes.test.ts` | Added |
| `tests/routes/v1/accountAuthRoutes.test.ts` | Modified — register tests |

---

## Impact analysis

- **API compatibility:** **Non-breaking** for existing auth/receivable clients. **Additive:** `POST /v1/auth/register`, all `/v1/sellers/*` routes. JWT `profileId` for seller accounts changes from mock to real `seller.id` — clients relying on mock format must update (dev-only impact).
- **Database:** New `sellers` table; no changes to existing tables except application-level joins. `walletId` column present but unconstrained until wallet module.
- **Performance:** List query indexed on `status`. Single-row lookups by `accountId` (unique) and `id` (PK). No full-table scans.
- **Other modules:**
  - **Account:** register extends auth; login/refresh now resolve seller profileId.
  - **Receivables:** create command requires `seller.status = active`.
  - **Wallet (future):** approval hook in `transitionSellerStatusCommand`; atomicity TBD (OQ-2).
  - **Risk analyst (future):** route guards accept `risk_analyst` role; v1 enforcement limited to `admin`.

---

## Test strategy

### Unit — domain/seller/validators

| Scenario | Input | Expected |
|----------|-------|----------|
| Valid CNPJ | 14 digits | passes |
| Invalid CNPJ | 13 digits or formatted | `validation_error` |
| Valid CPF | 11 digits | passes |
| Phone with formatting | `(41) 99944-9944` | `validation_error` |
| Business relations — 0 clients | `{ clients: [], suppliers: […] }` | `validation_error` |
| Business relations — 6 clients | 6 entries | `validation_error` |
| Money mapping | `shareCapital: 150000.00` reais | stored as `15000000` cents |

### Unit — domain/seller/transitions

| Scenario | From → To | Actor | Expected |
|----------|-----------|-------|----------|
| Submit | created → in_review | seller (own) | passes |
| Submit | created → in_review | other seller | `forbidden` |
| Approve | in_review → active | admin | passes |
| Approve | in_review → active | seller | `forbidden` |
| Reject | in_review → inactive | admin | passes |
| Deactivate | active → inactive | admin | passes |
| Reactivate | inactive → active | admin | passes |
| Illegal | created → active | admin | `invalid_status_transition` |
| Metadata PATCH | status in_review | seller | `metadata_locked` |

### Unit — domain/seller/policies

| Scenario | Actor | Seller | Expected |
|----------|-------|--------|----------|
| Read own | seller profileId match | any status | passes |
| Read other | seller | different id | `forbidden` |
| Read in_review | risk_analyst | in_review | passes |
| Read active | risk_analyst | active | `forbidden` (v1) |
| Admin read | admin | any | passes |

### Integration — register + onboarding

- Register creates account + seller atomically; rollback on duplicate email.
- Register returns JWT with `profileId = seller.id`.
- PATCH metadata while `created` succeeds; after submit, PATCH returns 409.
- Submit with incomplete metadata → 400 `incomplete_metadata`.
- Submit with valid metadata → status `in_review`.

### Integration — admin flows

- Admin lists `in_review` sellers.
- Admin approves → status `active`; walletId remains null.
- Admin rejects → status `inactive`.
- Admin deactivates active seller; admin reactivates inactive seller.
- Admin soft-deletes; seller excluded from GET/list.

### Integration — receivable guard

- Seller with status `created` / `in_review` / `inactive` cannot create receivable → 403.
- Seller with status `active` can create receivable.
- Soft-deleted seller cannot create receivable.

### API / E2E

- Full flow: register → PATCH metadata (3 sections) → submit → admin approve → create receivable.
- Register → login → GET own seller profile.

---

## Observability

- **Logs:** Log `sellerId`, `fromStatus`, `toStatus`, and `actorRole` at `info` on status transitions. Log `sellerId` on soft-delete at `info`. Never log metadata containing PII at `debug` in production configs (CNPJ, CPF, phone).
- **Error handling:** Seller errors surface as `{ error: "<code>" }` with optional `details` for Zod/validation flatten. Unexpected errors → Fastify 500.
- **Audit:** `updatedAt` bumped on every mutation (FR success metric). No separate audit table in v1.

---

## Open questions resolved

| Question (from PRD / rules) | Decision |
|-----------------------------|----------|
| OQ-1: Can risk_analyst view sellers outside `in_review`? | **v1: No.** `risk_analyst` may only list/read sellers with `status = in_review`. Admin retains full visibility. Revisit when risk module ships. |
| OQ-2: Approval + wallet creation atomic? | **Deferred.** This module leaves `walletId` null on approve. When wallet module lands, default to **single transaction** (approve + create wallet + set FK) unless perf/blocking concerns arise. |
| OQ-3: Max reactivations? | **Unrestricted in v1.** Admin may reactivate `inactive → active` unlimited times; log transitions for compliance review. |
| OQ-4: Soft-deleted sellers in queries? | **Excluded by default** (`deleted_at IS NULL`). No dedicated admin "trash" view in v1; admin soft-delete is one-way for operational queries. |
| PRD FR-5 vs `money.mdc` (API em centavos vs reais) | **`money.mdc` prevalece.** API recebe e devolve **reais com 2 casas decimais** (ex: `150000.00`); banco armazena **inteiro em centavos** (ex: `15000000`). Conversão feita na borda via `toCents` / `toReais`. PRD FR-5 ("API in cents") está incorreto — corrigido nesta spec. |
| `module-seller.mdc`: inactive is terminal | **PRD wins:** allow `inactive → active` reactivation by admin (FR-13). Update module rule when implementing. |
| Document upload required before submit? | **No in v1** (documents module out of scope). Submit validates metadata only. Extend when documents module exists. |
| Register auto-login vs 201 only? | **Auto-login** — return same token shape as login plus `sellerId` to reduce frontend friction. |
| `walletId` FK without wallets table? | **Nullable text, no FK** in this migration. Add FK constraint with wallet module. |
| Account status at seller registration | **`active`** on account; seller onboarding gate is `seller.status`, not account.status. |
