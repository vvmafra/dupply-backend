# Tech Spec — Remove Payer Confirmation Gate

## Overview

Remove the payer confirmation gate from the receivable lifecycle: seller acceptance of the analyst offer transitions directly `offer → confirmed` instead of `offer → approved`, and the payer receives a **best-effort informational notification** (no blocking action). Retire `approved` and `payer_rejected` from the active status machine; deprecate `POST /v1/payers/magic-link/respond` and the `payer_magic_link` transition actor.

**In scope:** domain transition rewrite (10 active statuses), `sellerDecisionCommand` + notification hook, duplicate-guard / partial-index alignment, DB migration (`approved → confirmed` data + index DDL), docs (`API.md`, `.cursor/rules/module-receivables.mdc`, `module-payer.mdc`), test updates.

**Out of scope:** email template copy, Module 4 full notification infrastructure, frontend status labels, audit log, re-enabling payer confirmation via feature flag, legal/compliance sign-off (OQ-5).

Reference: [`tasks/prd-receivable-remove-payer-confirmation/prd.md`](prd.md), amends [`tasks/prd-receivable-module/techspec.md`](../prd-receivable-module/techspec.md).

---

## Architecture overview

```
Domain (domain/receivable/transitions.ts, businessKey.ts)
  └── RECEIVABLE_STATUS: remove APPROVED, PAYER_REJECTED
  └── assertReceivableTransition: offer → confirmed (seller); remove payer_magic_link branch
  └── LEGACY_RECEIVABLE_STATUSES for read-only historical values (OQ-3)
        │
Application (application/receivable/commands/sellerDecisionCommand.ts)
  └── accept → confirmed + best-effort notifyPayerReceivableConfirmed (port stub)
  └── delete payerMagicLinkRespondCommand.ts (FR-4)
        │
HTTP (routes/v1/receivables.ts, routes/v1/payers.ts)
  └── seller-decision unchanged contract; behavior change only
  └── magic-link/respond → 410 Gone (OQ-2)
        │
Infrastructure (db/schema.ts, schema.pg.ts, drizzle/0009_*.sql)
  └── partial unique indexes drop `approved` from WHERE clause
  └── UPDATE receivables SET status='confirmed' WHERE status='approved'
```

```
Seller POST seller-decision { decision: "accept" }
  → load receivable; assertSellerOwnsReceivable
  → assertReceivableTransition(offer → confirmed, user/seller)
  → DB update status = confirmed
  → notifyPayerReceivableConfirmed(deps, { receivableId, payerId })  // catch + log; never throws
  → { ok: true }
```

Addresses all FR-1 … FR-12 (see component sections).

---

## Component design

### 1. Domain transitions — `src/domain/receivable/transitions.ts`

**What changes:** Collapse seller accept into `confirmed`; remove `approved`, `payer_rejected`, and `payer_magic_link` actor.

```typescript
// Before
export const RECEIVABLE_STATUS = {
  // ...
  APPROVED: "approved",
  PAYER_REJECTED: "payer_rejected",
  CONFIRMED: "confirmed",
  // ...
} as const;

export type TransitionActor =
  | { kind: "system" }
  | { kind: "user"; role: string }
  | { kind: "payer_magic_link" };

// offer → APPROVED | REJECTED (seller)
// payer_magic_link: APPROVED → CONFIRMED | PAYER_REJECTED

// After
export const RECEIVABLE_STATUS = {
  CREATED: "created",
  UNDER_REVIEW: "under_review",
  REPROVED: "reproved",
  OFFER: "offer",
  REJECTED: "rejected",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  PAYER_SETTLED: "payer_settled",
  OVERDUE: "overdue",
} as const;

/** Historical DB values — no new transitions; still returned by GET (OQ-3). */
export const LEGACY_RECEIVABLE_STATUSES = {
  APPROVED: "approved",
  PAYER_REJECTED: "payer_rejected",
} as const;

export type TransitionActor =
  | { kind: "system" }
  | { kind: "user"; role: string };

// In assertReceivableTransition — seller branch:
if (from === RECEIVABLE_STATUS.OFFER) {
  if (to === RECEIVABLE_STATUS.CONFIRMED || to === RECEIVABLE_STATUS.REJECTED) {
    if (!isSellerRole(role)) throw new ReceivableTransitionError("seller_role_required");
    return;
  }
}
// Remove entire payer_magic_link block (FR-3, FR-4)
```

Update `isReceivableStatus` to accept legacy values for API serialization safety:

```typescript
export function isReceivableStatus(value: string): value is ReceivableStatus {
  return (
    (Object.values(RECEIVABLE_STATUS) as string[]).includes(value) ||
    (Object.values(LEGACY_RECEIVABLE_STATUSES) as string[]).includes(value)
  );
}
```

**Justification:** FR-7 requires historical `payer_rejected` rows to remain readable without re-opening the retired transition path. Legacy constants keep audit data valid without polluting the active machine.

Addresses: **FR-1, FR-2, FR-3, FR-4, FR-5, FR-11**.

---

### 2. Seller decision command — `src/application/receivable/commands/sellerDecisionCommand.ts`

**What changes:** Map `accept` to `CONFIRMED`; invoke notification port after successful DB write.

```typescript
// Before
const to =
  input.decision === "accept" ? RECEIVABLE_STATUS.APPROVED : RECEIVABLE_STATUS.REJECTED;

await deps.db.update(receivables).set({ status: to, updatedAt: new Date() })...;

// After
const to =
  input.decision === "accept" ? RECEIVABLE_STATUS.CONFIRMED : RECEIVABLE_STATUS.REJECTED;

assertReceivableTransition(from, to, { kind: "user", role: input.actorRole });

await deps.db
  .update(receivables)
  .set({ status: to, updatedAt: new Date() })
  .where(eq(receivables.id, input.receivableId));

if (to === RECEIVABLE_STATUS.CONFIRMED) {
  try {
    await notifyPayerReceivableConfirmed(deps, {
      receivableId: input.receivableId,
      payerId: row.payerId,
    });
  } catch (err) {
    deps.logger?.warn?.({ err, receivableId: input.receivableId }, "payer_notification_failed");
  }
}
```

Addresses: **FR-1, FR-6**.

---

### 3. Payer notification port — `src/application/payer/ports/receivableNotification.ts` *(new)*

**What changes:** Application port stub (same pattern as `magicLinkToken.ts`) until Module 4 ships email transport.

```typescript
import type { AppDeps } from "../../deps.js";

export type NotifyPayerReceivableConfirmedInput = {
  receivableId: string;
  payerId: string;
};

/** Stub — Module 4 will send informational email (duplicata discounted, pay Dupply at due date). */
export async function notifyPayerReceivableConfirmed(
  _deps: AppDeps,
  _input: NotifyPayerReceivableConfirmedInput,
): Promise<void> {
  // no-op in v1 of this feature; hook point for Module 4
}
```

**Justification (OQ-1):** Implement hook + stub in this feature; Module 4 owns transport/templates later. Failure must not roll back seller decision (FR-6).

Addresses: **FR-6**.

---

### 4. Deprecate payer magic-link respond — remove command + 410 route

**Files:**
- **Delete:** `src/application/receivable/commands/payerMagicLinkRespondCommand.ts`
- **Modify:** `src/routes/v1/payers.ts`

Replace handler with documented deprecation (OQ-2 decision: **410 Gone** for one release cycle):

```typescript
api.post(
  "/v1/payers/magic-link/respond",
  {
    schema: {
      tags: ["Payers"],
      summary: "[Deprecated] Payer confirmation via magic link — removed; receivables proceed on seller accept",
      deprecated: true,
      security: [],
      body: magicLinkRespondBodySchema,
    },
  },
  async (_request, reply) => {
    return reply.code(410).send({
      error: "payer_confirmation_removed",
      message:
        "Payer confirmation no longer gates receivable settlement. Seller acceptance moves the receivable to confirmed.",
    });
  },
);
```

Keep `src/application/payer/ports/magicLinkToken.ts` for now (Module 4 may reuse token infra for informational links later).

Addresses: **FR-4**.

---

### 5. Duplicate guard — `src/domain/receivable/businessKey.ts`

**What changes:** Remove `APPROVED` from blocking list; remove `PAYER_REJECTED` from terminal list (new receivables cannot reach it).

```typescript
export const DUPLICATE_BLOCKING_STATUSES: readonly ReceivableStatus[] = [
  RECEIVABLE_STATUS.CREATED,
  RECEIVABLE_STATUS.UNDER_REVIEW,
  RECEIVABLE_STATUS.OFFER,
  // APPROVED removed
  RECEIVABLE_STATUS.CONFIRMED,
  RECEIVABLE_STATUS.PROCESSING,
  RECEIVABLE_STATUS.COMPLETED,
  RECEIVABLE_STATUS.OVERDUE,
] as const;

export const DUPLICATE_TERMINAL_STATUSES: readonly ReceivableStatus[] = [
  RECEIVABLE_STATUS.REPROVED,
  RECEIVABLE_STATUS.REJECTED,
  // PAYER_REJECTED removed — historical rows still non-blocking (not in BLOCKING list)
  RECEIVABLE_STATUS.PAYER_SETTLED,
] as const;
```

Addresses: **FR-8**.

---

### 6. DB migration — `drizzle/0009_remove_payer_confirmation_gate.sql`

**Files:** `src/db/schema.ts`, `src/db/schema.pg.ts`, new migration.

Steps:
1. **Data migration:** `UPDATE receivables SET status = 'confirmed', updated_at = NOW() WHERE status = 'approved';`
2. **Recreate partial unique indexes** (SQLite + Postgres variants) — drop `approved` from status IN list:

```sql
-- Example (Postgres) — mirror in schema.ts .where() clauses
DROP INDEX IF EXISTS receivables_seller_bill_active_unique;
CREATE UNIQUE INDEX receivables_seller_bill_active_unique
  ON receivables (seller_id, normalized_bill_number)
  WHERE deleted_at IS NULL
    AND normalized_bill_number IS NOT NULL
    AND status IN ('created','under_review','offer','confirmed','processing','completed','overdue');
```

3. No CHECK constraint on `receivables.status` exists today — no constraint DDL beyond indexes.

**Note:** Rows with `status = 'payer_rejected'` are untouched (FR-7).

Addresses: **FR-7, FR-9**.

---

### 7. Registry / tokenization hook alignment — docs + future wiring

**Files:** `.cursor/rules/module-receivables.mdc` (normative); no runtime registry hook exists yet in `src/`.

Update documentation: `registry_on_chain` creation trigger moves from **`approved`** to **`confirmed`** (OQ-4: same business moment — seller + analyst aligned, operation proceeds).

When Module 7 connects the hook, listen on `confirmed` entry (same place as notification hook in `sellerDecisionCommand` or a domain event later).

Addresses: **FR-10**, OQ-4.

---

### 8. Documentation updates

| Document | Change |
|----------|--------|
| `API.md` | Lifecycle: `offer → confirmed \| rejected`; remove payer magic-link gate; note deprecated route |
| `.cursor/rules/module-receivables.mdc` | 10-status diagram, RBAC matrix, routes table |
| `.cursor/rules/module-payer.mdc` | Informational notification on `confirmed`; deprecate confirm flow |

Addresses: **FR-10**.

---

### 9. Swagger / route summaries

**File:** `src/routes/v1/receivables.ts`

Optional summary tweak for clarity:

```typescript
summary: "Seller accepts or rejects analyst offer (accept → confirmed)",
```

**File:** `src/routes/v1/payers.ts` — `deprecated: true` on magic-link route (see §4).

Addresses: **FR-10**.

---

## Data flow

```
POST /v1/receivables/:id/seller-decision
  → Zod { decision: "accept" | "reject" }
  → requireJwt + requireRoles("seller") + ownership (in command)
  → executeSellerDecision
      → assertReceivableTransition(offer → confirmed | rejected)
      → UPDATE receivables SET status
      → notifyPayerReceivableConfirmed (best-effort, swallowed)
  → 200 { ok: true }

POST /v1/payers/magic-link/respond  [deprecated]
  → 410 { error: "payer_confirmation_removed", message: "..." }

POST /v1/internal/receivables/:id/advance-settlement  [unchanged]
  → assertReceivableTransition(confirmed → processing → completed, system)
```

---

## Files changed

| File | Change type |
|------|-------------|
| `src/domain/receivable/transitions.ts` | Modified |
| `src/domain/receivable/businessKey.ts` | Modified |
| `src/application/receivable/commands/sellerDecisionCommand.ts` | Modified |
| `src/application/receivable/commands/payerMagicLinkRespondCommand.ts` | Deleted |
| `src/application/payer/ports/receivableNotification.ts` | Added |
| `src/routes/v1/payers.ts` | Modified |
| `src/routes/v1/receivables.ts` | Modified (summary) |
| `src/db/schema.ts` | Modified |
| `src/db/schema.pg.ts` | Modified |
| `drizzle/0009_remove_payer_confirmation_gate.sql` | Added |
| `tests/domain/receivable/transitions.test.ts` | Modified |
| `tests/application/receivable/sellerDecisionCommand.test.ts` | Modified |
| `tests/application/receivable/payerMagicLinkRespondCommand.test.ts` | Deleted |
| `tests/routes/v1/payers.test.ts` | Modified |
| `tests/domain/receivable/businessKey.test.ts` | Modified (if exists) |
| `API.md` | Modified |
| `.cursor/rules/module-receivables.mdc` | Modified |
| `.cursor/rules/module-payer.mdc` | Modified |
| `.cursor/rules/entities-overview.mdc` | Modified (payer interaction note) |

---

## Impact analysis

- **API compatibility:** **Breaking.** Clients expecting `approved` after seller accept must handle `confirmed`. Magic-link respond returns **410 Gone**. Historical API responses may still include `payer_rejected` for old rows.
- **Database:** Migration required — data (`approved → confirmed`) + partial index DDL on `receivables`.
- **Performance:** No O(N) concerns; single-row UPDATE + optional notification stub.
- **Other modules:**
  - **Module 4 (payer):** Notification hook replaces magic-link gate; token port retained.
  - **Module 7 (registry):** Trigger point documented as `confirmed` (no code change until wired).
  - **Duplicate guard:** Index + constant alignment only.

---

## Test strategy

### Unit — `assertReceivableTransition`

| Scenario | Input | Expected |
|----------|-------|----------|
| Seller accept | `offer → confirmed`, user/seller | pass |
| Seller reject | `offer → rejected`, user/seller | pass |
| Seller accept removed path | `offer → approved`, user/seller | `ReceivableTransitionError` |
| Payer magic link | any transition, `payer_magic_link` actor | `ReceivableTransitionError` |
| System settlement | `confirmed → processing → completed → payer_settled/overdue` | unchanged — pass |
| Status count | `RECEIVABLE_STATUS` keys | 10 active statuses |
| Legacy readable | `isReceivableStatus("payer_rejected")` | `true` |

### Unit — `sellerDecisionCommand`

| Scenario | Input | Expected |
|----------|-------|----------|
| Accept | `decision: "accept"` on offer | DB status = `confirmed` |
| Reject | `decision: "reject"` on offer | DB status = `rejected` |
| Notification failure | stub throws | status still `confirmed`; command resolves |

### Unit — duplicate guard constants

| Scenario | Expected |
|----------|----------|
| `DUPLICATE_BLOCKING_STATUSES` | does not include `approved` |
| `DUPLICATE_TERMINAL_STATUSES` | does not include `payer_rejected` |

### Integration — HTTP routes

- `POST seller-decision accept` → 200; GET receivable shows `confirmed`
- `POST /v1/payers/magic-link/respond` → **410** with `payer_confirmation_removed`
- Internal advance-settlement from `confirmed` → unchanged happy path

### API / E2E

- Full lifecycle: create → submit → risk offer → seller accept → internal advance → payer settlement (no magic-link step)

Addresses: **FR-12**.

---

## Observability

- **New log:** `payer_notification_failed` at **warn** level in `sellerDecisionCommand` when `notifyPayerReceivableConfirmed` throws (includes `receivableId`, error).
- **Deprecation:** log at **info** when magic-link respond receives traffic (optional metric for consumer migration).
- **Error handling:** Seller decision errors unchanged (`409 invalid_receivable_transition`, `403 not_owner`). Notification failures invisible to HTTP caller (FR-6).

---

## Open questions resolved

| Question (from PRD) | Decision |
|---------------------|----------|
| **OQ-1** Notification ownership | Hook + port stub in `sellerDecisionCommand` / `receivableNotification.ts`; Module 4 implements email later. |
| **OQ-2** Magic-link route deprecation | **410 Gone** with `payer_confirmation_removed` for transition period; route kept with `deprecated: true` in OpenAPI. Hard delete in a follow-up release once consumers migrate. |
| **OQ-3** Historical `payer_rejected` rows | Keep raw string in DB; add `LEGACY_RECEIVABLE_STATUSES`; no transitions out; `isReceivableStatus` accepts legacy values for GET responses. |
| **OQ-4** Module 7 registry hook | Tokenization trigger documented and aligned to **`confirmed`** (same business moment as former `approved`). Runtime hook deferred to Module 7 wiring. |
| **OQ-5** Legal/compliance | Out of scope for engineering; product/legal must confirm before production rollout. No code gate. |
