# Tech Spec — Receivable Module v2

## Overview

Full rewrite of the receivable (duplicata) module to replace the prototype implementation with the production v2 model: 12-status lifecycle, draft creation, seller decision step, payer magic-link response, settlement tracking, and schema alignment (`sellerId`/`payerId` FKs, native timestamps, structured `receivableMetaData`).

**In scope:** DB migration, domain state machine + policies, application commands/queries (CQRS split), public HTTP routes (`/v1/receivables/*`), internal settlement routes (`/v1/internal/receivables/*`), and the payer magic-link **consumer** route (`POST /v1/payers/magic-link/respond`) that transitions receivable status.

**Out of scope (unchanged from PRD):** magic-link token generation and email dispatch, `registry_on_chain` creation on `approved`, payer notification emails, admin management UI, transition audit log, cursor-based pagination beyond default limit 200.

Reference: [`tasks/prd-receivable-module/prd.md`](prd.md), [`.cursor/rules/module-receivables.mdc`](../../.cursor/rules/module-receivables.mdc).

---

## Architecture overview

```
HTTP (routes/v1/receivables.ts, receivable-internal.ts, payers.ts)
  └── Zod validation, requireJwt / requireRoles / requireDupplyApiKey
  └── thin error mapping (ReceivableError, SellerError, ReceivableTransitionError)
        │
Application (application/receivable/commands/*, queries/*)
  └── orchestrates domain guards + DB + payer upsert port
        │
Domain (domain/receivable/transitions.ts, policies.ts, metadata.ts, types.ts)
  └── assertReceivableTransition — single RBAC source for status changes
  └── ownership / metadata completeness — no HTTP imports
        │
Infrastructure (db/schema.ts, schema.pg.ts, drizzle migration)
  └── receivables v2 table + payers table (Module 4 co-migration)
```

```
Seller POST draft
  → resolve sellerId from JWT profileId
  → upsert payer by payerCnpj (preserve existing record — OQ-3)
  → insert receivable (status = created)

Seller PATCH draft (status = created only)
  → merge receivableMetaData + value

Seller POST submit
  → validate metadata completeness (domain)
  → assertReceivableTransition(created → under_review)

Risk POST risk-decision
  → assertReceivableTransition(under_review → offer | reproved)

Seller POST seller-decision
  → ownership check + assertReceivableTransition(offer → approved | rejected)

Payer POST magic-link/respond (token in body)
  → validate token (Module 4 port) + assertReceivableTransition(approved → confirmed | payer_rejected)

System POST internal/advance-settlement | payer-settlement
  → assertReceivableTransition with { kind: "system" }
```

---

## Component design

### 1. DB schema migration — `drizzle/0006_receivables_v2.sql`

**Files:** `src/db/schema.ts`, `src/db/schema.pg.ts`, new migration.

The prototype table uses legacy columns (`seller_user_id`, `payer_user_id`, `created_at_ms`, `updated_at_ms`, `receivable_md`). Since this module is non-production, the migration **drops and recreates** `receivables` (no data backfill).

**Prerequisite:** `payers` table must exist. Ship `payers` in the same migration (Module 4 minimal schema from `module-payer.mdc`) so FK constraints are satisfied.

```typescript
// New tables / columns (both schema.ts and schema.pg.ts — keep in sync)

export const payers = pgTable("payers", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("active"),
  legalName: text("legal_name").notNull(),
  email: text("email").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const receivables = pgTable("receivables", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  sellerId: text("seller_id").notNull().references(() => sellers.id),
  payerId: text("payer_id").notNull().references(() => payers.id),
  receivableMetaData: text("receivable_meta_data"),
  value: text("value").notNull(),           // decimal string, centavos BRL
  proposedValue: text("proposed_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("receivables_seller_id_idx").on(t.sellerId),
  index("receivables_payer_id_idx").on(t.payerId),
  index("receivables_status_idx").on(t.status),
]);
```

Migration steps:
1. `DROP TABLE IF EXISTS receivables;`
2. `CREATE TABLE payers (...)` (if not already present from Module 4).
3. `CREATE TABLE receivables (...)` with new FKs and indexes.

Addresses: **FR-11, FR-12**.

---

### 2. Domain types — `src/domain/receivable/types.ts` *(new)*

Canonical TypeScript shape for metadata (stored as JSON string in DB):

```typescript
export type ReceivableMetaData = {
  type: "commercial" | "service";
  billNumber: string;
  invoiceNumber: string;
  issuedAt: string;              // ISO 8601 date YYYY-MM-DD
  dueDate: string;
  payerCnpj: string;               // 14 digits
  payerLegalName: string;
  payerFinancialEmail: string;
  fiscalDocumentType: "nfe" | "nfce" | "nfse" | "other";
  fiscalDocumentKey: string;
  proofType: "delivery" | "acceptance" | "service_provision";
  payerAcceptanceStatus: "accepted" | "pending" | "refused";
  desiredAnticipationValue: number; // centavos BRL
  antifraudDeclarationsAccepted: boolean;
};

export type ReceivableRow = {
  id: string;
  status: string;
  sellerId: string;
  payerId: string;
  receivableMetaData: string | null;
  value: string;
  proposedValue: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
```

Addresses: **FR-12**.

---

### 3. Domain metadata validation — `src/domain/receivable/metadata.ts` *(new)*

Completeness check runs **only on submit** (FR-3), not on draft create/patch.

```typescript
import type { ReceivableMetaData } from "./types.js";
import { ReceivableError, RECEIVABLE_ERROR_CODES } from "./errors.js";

const REQUIRED_STRING_FIELDS: (keyof ReceivableMetaData)[] = [
  "type", "billNumber", "invoiceNumber", "issuedAt", "dueDate",
  "payerCnpj", "payerLegalName", "payerFinancialEmail",
  "fiscalDocumentType", "fiscalDocumentKey", "proofType", "payerAcceptanceStatus",
];

export function parseReceivableMetaData(raw: string | null): ReceivableMetaData | null {
  if (!raw) return null;
  return JSON.parse(raw) as ReceivableMetaData;
}

export function assertReceivableMetaDataComplete(raw: string | null): ReceivableMetaData {
  const meta = parseReceivableMetaData(raw);
  if (!meta) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    if (!meta[field] || String(meta[field]).trim() === "") {
      throw new ReceivableError(RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
    }
  }
  if (meta.antifraudDeclarationsAccepted !== true) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
  }
  if (typeof meta.desiredAnticipationValue !== "number" || meta.desiredAnticipationValue <= 0) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
  }
  return meta;
}
```

Addresses: **FR-3, FR-12**.

---

### 4. Domain errors — `src/domain/receivable/errors.ts` *(new)*

Typed errors for consistent HTTP mapping in routes:

```typescript
export const RECEIVABLE_ERROR_CODES = {
  NOT_FOUND: "receivable_not_found",
  FORBIDDEN: "forbidden",
  NOT_OWNER: "not_owner",
  METADATA_LOCKED: "metadata_locked",
  INCOMPLETE_METADATA: "incomplete_metadata",
  SELLER_PAYER_MUST_DIFFER: "seller_and_payer_must_differ",
  PROPOSED_VALUE_REQUIRED: "proposed_value_required_for_offer",
  PROPOSED_VALUE_FORBIDDEN: "proposed_value_not_allowed_for_reprove",
  SOFT_DELETED: "receivable_deleted",
} as const;

export class ReceivableError extends Error {
  constructor(readonly code: (typeof RECEIVABLE_ERROR_CODES)[keyof typeof RECEIVABLE_ERROR_CODES]) {
    super(code);
    this.name = "ReceivableError";
  }
}
```

Addresses: cross-cutting error handling for all FRs.

---

### 5. Domain policies — `src/domain/receivable/policies.ts` *(new)*

Ownership and read ACL live here (not inline in routes beyond thin delegation):

```typescript
export function assertSellerOwnsReceivable(
  actor: { profileId: string },
  receivable: { sellerId: string },
): void { /* throws ReceivableError NOT_OWNER */ }

export function assertCanUpdateReceivableDraft(receivable: { status: string; deletedAt: Date | null }): void {
  // status must be "created", not soft-deleted → else METADATA_LOCKED
}

export function assertCanViewReceivable(
  actor: { profileId: string; role: string },
  receivable: { sellerId: string },
): boolean {
  // seller: profileId === sellerId
  // risk_analyst | risk_analyst_agent | admin: true
  // payer: false (FR-8 — no access via this route)
}

export function assertSellerPayerCnpjDiffer(
  sellerCnpj: string,
  payerCnpj: string,
): void {
  // normalize digits-only compare → SELLER_PAYER_MUST_DIFFER
}
```

Seller CNPJ is read from `sellers.companyMetaData` JSON (`CompanyMetaData.cnpj`) at command time.

Addresses: **FR-2, FR-5, FR-8, FR-14**.

---

### 6. State machine rewrite — `src/domain/receivable/transitions.ts`

Replace the 6-status prototype with the full 12-status machine. Add `payer_magic_link` actor kind. Rename risk rejection target from `rejected` to `reproved`.

```typescript
export const RECEIVABLE_STATUS = {
  CREATED: "created",
  UNDER_REVIEW: "under_review",
  REPROVED: "reproved",
  OFFER: "offer",
  REJECTED: "rejected",
  APPROVED: "approved",
  PAYER_REJECTED: "payer_rejected",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  PAYER_SETTLED: "payer_settled",
  OVERDUE: "overdue",
} as const;

export type TransitionActor =
  | { kind: "system" }
  | { kind: "user"; role: string }
  | { kind: "payer_magic_link" };

export function assertReceivableTransition(
  from: ReceivableStatus,
  to: ReceivableStatus,
  actor: TransitionActor,
): void {
  // System-only transitions:
  //   confirmed → processing → completed
  //   completed → payer_settled | overdue
  //   overdue → payer_settled

  // User transitions (role-checked):
  //   POST implicit → created (seller)
  //   created → under_review (seller)
  //   under_review → offer | reproved (risk_analyst | risk_analyst_agent)
  //   offer → approved | rejected (seller)

  // payer_magic_link transitions:
  //   approved → confirmed | payer_rejected
}
```

Remove the obsolete `offer → confirmed` payer-JWT path from the prototype. Payer response is exclusively via magic link.

Update `tests/domain/receivable/transitions.test.ts` to cover all 12 statuses, every authorized actor, and representative unauthorized actors per transition.

Addresses: **FR-4, FR-5, FR-6, FR-10**.

---

### 7. Payer upsert port — `src/application/payer/commands/upsertPayerByCnpj.ts` *(new)*

Shared helper invoked by create and submit commands. Implements OQ-3 (preserve existing):

```typescript
export type UpsertPayerInput = {
  cnpj: string;
  legalName: string;
  email: string;
};

export async function upsertPayerByCnpj(
  deps: AppDeps,
  input: UpsertPayerInput,
): Promise<{ payerId: string; created: boolean }> {
  const existing = await findPayerByCnpj(deps, input.cnpj);
  if (existing) {
    if (existing.deletedAt !== null) throw new PayerError(PAYER_ERROR_CODES.INACTIVE);
    return { payerId: existing.id, created: false }; // no overwrite of legalName/email
  }
  const id = createId();
  await deps.db.insert(payers).values({
    id,
    cnpj: input.cnpj,
    legalName: input.legalName,
    email: input.email,
    status: "active",
  });
  return { payerId: id, created: true };
}
```

**PRD vs rule resolution:** PRD FR-1 requires payer upsert on `POST /v1/receivables`. `module-receivables.mdc` mentions upsert on submit — **PRD wins**. Upsert runs on create; submit re-validates payer still active and may refresh `payerId` if `payerCnpj` changed in metadata (edge case — reject with 409 if CNPJ changed after create).

POST body for new payers requires `payerCnpj` plus `payerLegalName` and `payerFinancialEmail` (top-level or inside partial `receivableMetaData`) because `payers.legal_name` and `payers.email` are NOT NULL.

Addresses: **FR-1, FR-14** (partial — CNPJ available at create).

---

### 8. Application commands — split `receivableCommands.ts`

Replace the monolithic file with one handler per use case under `src/application/receivable/commands/`:

| File | Function | Key behavior |
|------|----------|--------------|
| `createReceivableCommand.ts` | `executeCreateReceivable` | Resolve `sellerId` from `profileId`; upsert payer; assert seller active; assert CNPJ differ; status `created`; `createId()` |
| `updateReceivableDraftCommand.ts` | `executeUpdateReceivableDraft` | PATCH only when `created`; merge JSON metadata + optional `value` |
| `submitReceivableCommand.ts` | `executeSubmitReceivable` | Ownership; `assertReceivableMetaDataComplete`; transition `created → under_review` |
| `riskDecisionCommand.ts` | `executeRiskDecision` | `decision: "offer" \| "reprove"`; `proposedValue` required iff offer; transition via guard |
| `sellerDecisionCommand.ts` | `executeSellerDecision` | `decision: "accept" \| "reject"` → `approved` / `rejected` |
| `payerMagicLinkRespondCommand.ts` | `executePayerMagicLinkRespond` | Validate token (port); transition `approved → confirmed \| payer_rejected` |
| `systemAdvanceSettlementCommand.ts` | `executeSystemAdvanceSettlement` | `confirmed → processing` or `processing → completed` |
| `systemPayerSettlementCommand.ts` | `executeSystemPayerSettlement` | `completed → payer_settled \| overdue` or `overdue → payer_settled` |

**Create command signature change:**

```typescript
// Before (prototype)
export type CreateReceivableInput = {
  sellerUserId: string;
  payerUserId: string;
  value: string;
  receivableMd?: string;
};

// After
export type CreateReceivableInput = {
  profileId: string;           // JWT profileId → sellers.id
  payerCnpj: string;
  payerLegalName?: string;     // required when payer CNPJ is new
  payerFinancialEmail?: string;
  value?: string;              // optional at draft; required before submit via metadata
  receivableMetaData?: Partial<ReceivableMetaData>;
};
```

**Risk decision — rename reject → reprove:**

```typescript
export type RiskDecisionInput = {
  receivableId: string;
  actorRole: string;
  decision: "offer" | "reprove";
  proposedValue?: string;
};
```

Delete `executePayerConfirm` (replaced by magic-link respond).

Every mutating command calls `assertReceivableTransition` immediately before the DB update. No inline role checks in commands — role is passed as part of `TransitionActor`.

Addresses: **FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-10, FR-13, FR-14**.

---

### 9. Application queries — `src/application/receivable/queries/`

Extract inline Drizzle from routes into query handlers:

**`listReceivablesQuery.ts`**

```typescript
export async function executeListReceivables(
  deps: AppDeps,
  actor: { profileId: string; role: AccountRole },
  limit = 200,
): Promise<ReceivableRow[]> {
  if (actor.role === "seller") {
    return db.select().from(receivables)
      .where(and(eq(receivables.sellerId, actor.profileId), isNull(receivables.deletedAt)))
      .limit(limit);
  }
  if (actor.role === "admin" || actor.role === "risk_analyst" || actor.role === "risk_analyst_agent") {
    return db.select().from(receivables)
      .where(isNull(receivables.deletedAt))
      .limit(limit);
  }
  throw new ReceivableError(RECEIVABLE_ERROR_CODES.FORBIDDEN);
}
```

**`getReceivableQuery.ts`** — load by id; apply `assertCanViewReceivable`; 404 if missing or soft-deleted.

Addresses: **FR-7, FR-8**.

---

### 10. Magic-link token validation port — `src/application/payer/ports/magicLinkToken.ts` *(new)*

FR-6 delegates token validation to Module 4. Define a port now; stub implementation returns parsed `{ receivableId, payerId }` for tests until Module 4 ships:

```typescript
export type MagicLinkTokenPayload = { receivableId: string; payerId: string };

export async function consumePayerMagicToken(
  deps: AppDeps,
  token: string,
): Promise<MagicLinkTokenPayload> {
  // Module 4: hash token, lookup payer_magic_tokens, check expiry/usedAt
  // throws PayerError on invalid/expired/used token
}
```

`executePayerMagicLinkRespond` verifies `row.payerId === payload.payerId` before transitioning.

Addresses: **FR-6**.

---

### 11. Public HTTP routes — `src/routes/v1/receivables.ts`

Full rewrite. Remove prototype routes (`POST .../confirm`, `payerUserId` body field). Add new routes per `module-receivables.mdc`.

| Route | preHandler | Notes |
|-------|------------|-------|
| `POST /v1/receivables` | `requireRoles("seller")` | Body: `{ payerCnpj, payerLegalName?, payerFinancialEmail?, value?, receivableMetaData? }` → 201 `{ id }` |
| `PATCH /v1/receivables/:id` | JWT + ownership in handler | Body: partial metadata + optional `value` → `{ ok: true }` |
| `POST /v1/receivables/:id/submit` | JWT + ownership | → `{ ok: true }` |
| `POST /v1/receivables/:id/risk-decision` | `requireRoles("risk_analyst", "risk_analyst_agent")` | Body: `{ decision: "offer" \| "reprove", proposedValue? }` |
| `POST /v1/receivables/:id/seller-decision` | JWT + ownership | Body: `{ decision: "accept" \| "reject" }` |
| `GET /v1/receivables` | JWT | Role-scoped list |
| `GET /v1/receivables/:id` | JWT | View ACL via domain policy |

**Remove** `POST /v1/receivables/:id/confirm` (replaced by payer magic-link flow).

Error mapping (representative):

| Error | HTTP |
|-------|------|
| `SellerError NOT_ACTIVE` | 403 `{ error: "seller_not_active" }` |
| `ReceivableError INCOMPLETE_METADATA` | 400 |
| `ReceivableError METADATA_LOCKED` | 409 |
| `ReceivableError SELLER_PAYER_MUST_DIFFER` | 400 |
| `ReceivableTransitionError` | 409 |
| `ReceivableError NOT_FOUND` | 404 |
| `ReceivableError NOT_OWNER` / `FORBIDDEN` | 403 |

Handlers pass `{ kind: "user", role: request.auth!.role }` to commands — **no** `if (role !== ...)` in handlers (FR-10).

Addresses: **FR-1–FR-8, FR-10, FR-13, FR-14**.

---

### 12. Payer magic-link route — `src/routes/v1/payers.ts` *(new)*

Thin route registered **outside** the JWT scope (public, token in body):

```typescript
api.post("/v1/payers/magic-link/respond", {
  schema: {
    tags: ["Payers"],
    summary: "Payer accepts or rejects receivable via magic link token",
    security: [],  // no bearerAuth
    body: z.object({
      token: z.string().min(1),
      decision: z.enum(["accept", "reject"]),
    }),
  },
}, async (request, reply) => {
  await executePayerMagicLinkRespond(deps, {
    token: request.body.token,
    decision: request.body.decision,
  });
  return { ok: true };
});
```

Register in `server.ts` in a public scope (same pattern as auth routes — no `requireJwt`).

Addresses: **FR-6**.

---

### 13. Internal routes — `src/routes/v1/receivable-internal.ts`

Extend existing file (already behind `requireDupplyApiKey`):

**Existing:** `POST /v1/internal/receivables/:id/advance-settlement`
- Body: `{ targetStatus: "processing" | "completed" }`

**New:** `POST /v1/internal/receivables/:id/payer-settlement`
- Body: `{ outcome: "settled" | "overdue" }`
- Maps: `completed + settled → payer_settled`, `completed + overdue → overdue`, `overdue + settled → payer_settled`

Both routes: `schema: { tags: ["Internal"], hide: true }` (or equivalent Swagger hide flag).

Addresses: **FR-9**.

---

## Data flow

### Draft create (FR-1)

```
POST /v1/receivables
  → requireJwt → requireRoles("seller")
  → Zod: payerCnpj (+ conditional payerLegalName/payerFinancialEmail)
  → executeCreateReceivable({ profileId: auth.profileId, ... })
      → load seller by profileId; assertSellerCanCreateReceivable
      → parse seller.companyMetaData.cnpj
      → assertSellerPayerCnpjDiffer(sellerCnpj, payerCnpj)
      → upsertPayerByCnpj
      → assertReceivableTransition(/* implicit */ → created, { kind: "user", role: "seller" })
      → INSERT receivables (status = created)
  → 201 { id }
```

### Submit (FR-3)

```
POST /v1/receivables/:id/submit
  → ownership check
  → assertReceivableMetaDataComplete(row.receivableMetaData)
  → assertReceivableTransition(created, under_review, { kind: "user", role: "seller" })
  → UPDATE status
  → 200 { ok: true }
```

### Payer magic link (FR-6)

```
POST /v1/payers/magic-link/respond
  → Zod: { token, decision }
  → consumePayerMagicToken(token) → { receivableId, payerId }
  → load receivable; verify payerId match + status = approved
  → assertReceivableTransition(approved, confirmed|payer_rejected, { kind: "payer_magic_link" })
  → UPDATE status
  → 200 { ok: true }
```

---

## Files changed

| File | Change type |
|------|-------------|
| `drizzle/0006_receivables_v2.sql` | Added — drop/recreate receivables; add payers |
| `src/db/schema.ts` | Modified — payers table; receivables v2 columns |
| `src/db/schema.pg.ts` | Modified — same |
| `src/domain/receivable/types.ts` | Added |
| `src/domain/receivable/metadata.ts` | Added |
| `src/domain/receivable/errors.ts` | Added |
| `src/domain/receivable/policies.ts` | Added |
| `src/domain/receivable/transitions.ts` | Modified — 12-status machine + payer_magic_link actor |
| `src/application/receivable/commands/createReceivableCommand.ts` | Added |
| `src/application/receivable/commands/updateReceivableDraftCommand.ts` | Added |
| `src/application/receivable/commands/submitReceivableCommand.ts` | Added |
| `src/application/receivable/commands/riskDecisionCommand.ts` | Added (replaces inline in monolith) |
| `src/application/receivable/commands/sellerDecisionCommand.ts` | Added |
| `src/application/receivable/commands/payerMagicLinkRespondCommand.ts` | Added |
| `src/application/receivable/commands/systemAdvanceSettlementCommand.ts` | Added (extracted) |
| `src/application/receivable/commands/systemPayerSettlementCommand.ts` | Added |
| `src/application/receivable/commands/receivableCommands.ts` | Deleted |
| `src/application/receivable/queries/listReceivablesQuery.ts` | Added |
| `src/application/receivable/queries/getReceivableQuery.ts` | Added |
| `src/application/payer/commands/upsertPayerByCnpj.ts` | Added |
| `src/application/payer/ports/magicLinkToken.ts` | Added |
| `src/routes/v1/receivables.ts` | Modified — full rewrite |
| `src/routes/v1/receivable-internal.ts` | Modified — add payer-settlement route |
| `src/routes/v1/payers.ts` | Added — magic-link respond |
| `src/server.ts` | Modified — register payers route (public scope) |
| `tests/domain/receivable/transitions.test.ts` | Modified — full coverage |
| `tests/application/receivable/*.test.ts` | Modified — split per command |
| `tests/routes/v1/receivables.test.ts` | Modified — v2 flows |
| `tests/routes/v1/payers.test.ts` | Added — magic-link respond |

---

## Impact analysis

- **API compatibility:** **Breaking.** Request/response shapes change (`payerUserId` → `payerCnpj`, draft `created` status, new routes, removed `POST .../confirm`). Acceptable per PRD (non-production module rewrite).
- **Database:** Migration required. Drops existing `receivables` rows. Adds `payers` table and new `receivables` schema with FK constraints to `sellers` and `payers`.
- **Performance:** `GET /v1/receivables` for staff roles scans up to 200 rows — same as today. Seller-scoped query uses indexed `seller_id`. No N+1 concerns in v1.
- **Other modules:**
  - **Module 4 (payer):** `payers` table and magic-link token port co-shipped; full email/token generation remains Module 4.
  - **Module 7 (registry):** hook on `approved` is out of scope; no code change here, but `seller-decision → approved` becomes the trigger point for future integration.
  - **Roles guard PRD:** `requireRoles` already applied to `POST /receivables` and `risk-decision`; extend to new routes where role is a pure allow-list only.

---

## Test strategy

### Unit — `assertReceivableTransition`

| Scenario | Input | Expected |
|----------|-------|----------|
| Seller creates (implicit) | `→ created`, seller actor | pass |
| Seller submits | `created → under_review`, seller | pass |
| Seller submits | `created → under_review`, risk_analyst | throw |
| Risk offers | `under_review → offer`, risk_analyst | pass |
| Risk reproves | `under_review → reproved`, risk_analyst | pass |
| Risk with wrong decision target | `under_review → rejected`, risk_analyst | throw |
| Seller accepts offer | `offer → approved`, seller | pass |
| Seller rejects offer | `offer → rejected`, seller | pass |
| Payer accepts (magic link) | `approved → confirmed`, payer_magic_link | pass |
| Payer rejects (magic link) | `approved → payer_rejected`, payer_magic_link | pass |
| System advance | `confirmed → processing → completed`, system | pass |
| System payer settlement | `completed → payer_settled`, system | pass |
| System overdue + late pay | `completed → overdue`, then `overdue → payer_settled`, system | pass |
| Terminal re-entry | `reproved → under_review`, any | throw |

### Unit — metadata validation

| Scenario | Expected |
|----------|----------|
| All required fields present + antifraud true | pass |
| Missing `dueDate` | `INCOMPLETE_METADATA` |
| `antifraudDeclarationsAccepted: false` | `INCOMPLETE_METADATA` |

### Unit — policies

| Scenario | Expected |
|----------|----------|
| Seller views own receivable | allowed |
| Seller views other's receivable | forbidden |
| Payer views via GET | forbidden (FR-8) |
| Admin views any | allowed |
| PATCH when status = `under_review` | `METADATA_LOCKED` |
| Same CNPJ seller/payer | `SELLER_PAYER_MUST_DIFFER` |

### Integration — commands

- Active seller creates draft → status `created`, `sellerId` and `payerId` populated.
- Inactive seller create → `SellerError NOT_ACTIVE`.
- Submit with incomplete metadata → `INCOMPLETE_METADATA`.
- Risk offer without `proposedValue` → error.
- Risk reprove with `proposedValue` present → error.
- Seller decision on non-owner receivable → `NOT_OWNER`.
- Payer magic-link respond with invalid token → 4xx from port.

### Integration — HTTP routes

- Full happy path: create → patch → submit → risk offer → seller accept → magic-link accept → internal advance → internal payer settlement.
- `GET /receivables` as seller returns only own rows.
- `POST /receivables/:id/confirm` returns 404 (removed).
- Internal routes without API key → 401; visible in Swagger only under hidden Internal tag.

---

## Observability

- No new structured logs required for v1. Fastify request logging captures 4xx/5xx outcomes.
- Domain/application errors surface to callers via stable `{ error: "<code>" }` bodies — existing convention.
- `ReceivableTransitionError.message` carries machine-readable codes (e.g. `risk_role_required`, `transition_not_allowed`) for 409 responses.

---

## Open questions resolved

| Question (from PRD) | Decision |
|---------------------|----------|
| OQ-1: Is `overdue` recoverable? | **Yes.** `overdue → payer_settled` allowed for system actor. Implemented in `assertReceivableTransition`. |
| OQ-2: Can seller resubmit after `payer_rejected`? | **No.** Terminal state. Seller must create a new receivable. No transition out of `payer_rejected`. |
| OQ-3: Payer upsert on CNPJ collision | **Preserve existing** `legalName` and `email`. Implemented in `upsertPayerByCnpj`. |
| PRD FR-1 vs `module-receivables.mdc` upsert timing | **Upsert on POST** (PRD wins). Submit re-validates payer is still active; does not overwrite existing payer fields. |
| Risk decision verb: `reject` vs `reprove` | **`reprove`** for analyst rejection (`under_review → reproved`). **`reject`** reserved for seller refusal of offer (`offer → rejected`). |
| Payer confirm route removal | **`POST /v1/receivables/:id/confirm` deleted.** Payer acts only via `POST /v1/payers/magic-link/respond`. |
| `payer_magic_tokens` table | **Out of scope** for this PR — port interface defined; stub for tests until Module 4 implements token storage. |
| JWT `sub` vs `profileId` for seller ownership | **`profileId`** (maps to `sellers.id`) is the ownership key, consistent with seller module routes. |
