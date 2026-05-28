# Tech Spec — Receivable Duplicate Guard

## Overview

Add a **seller-scoped business-key uniqueness guard** for receivables (duplicatas): before any seller-initiated write, the system checks whether another non-deleted, **active** receivable for the same seller already holds the same normalized `billNumber` and/or `fiscalDocumentKey`. Collisions return HTTP `409` with a machine-readable error code. Resubmission is allowed after terminal outcomes (`reproved`, `rejected`, `payer_rejected`, `payer_settled`).

Implementation follows the **wallet module dual-layer pattern**: application-layer guard (primary, user-facing) + partial unique database indexes on materialized normalized columns (concurrency backstop).

**In scope:** domain normalization + status classification, application duplicate guard wired into all four seller write paths (`create`, `create-and-submit`, `submit`, `update draft`), new error codes + HTTP mapping, DB migration (materialized columns + partial unique indexes), unit/integration/route tests.

**Out of scope (unchanged from PRD):** frontend error UX, deduplication/merging of pre-existing duplicate rows, cross-seller duplicate detection, stale draft cleanup, read-route changes, status machine / RBAC changes.

Reference: [`tasks/prd-receivable-duplicate-guard/prd.md`](prd.md), [`.cursor/rules/module-receivables.mdc`](../../.cursor/rules/module-receivables.mdc), wallet pattern in [`tasks/prd-wallet-module/techspec.md`](../prd-wallet-module/techspec.md).

**FR traceability:** FR-1–FR-10 covered in components below.

---

## Architecture overview

No new bounded context. Extend the existing **receivable** module with a domain business-key module and a shared application guard helper invoked by existing commands.

```
Domain (domain/receivable/)
  ├── businessKey.ts     — normalization, active/terminal status sets, derive materialized columns
  ├── errors.ts          — + duplicate_bill_number, duplicate_fiscal_document_key
  └── policies.ts        — (optional) isDuplicateBlockingStatus export from businessKey

Application (application/receivable/)
  ├── duplicateGuard.ts  — assertNoActiveReceivableDuplicate (DB lookup + throw)
  ├── receivableHelpers.ts — persist normalized metadata + materialized columns on write
  └── commands/
      ├── createReceivableCommand.ts
      ├── createAndSubmitReceivableCommand.ts
      ├── submitReceivableCommand.ts
      └── updateReceivableDraftCommand.ts

Infrastructure
  ├── db/schema.{ts,pg.ts}           — + normalizedBillNumber, normalizedFiscalDocumentKey
  └── drizzle/0008_receivable_duplicate_guard.sql

HTTP (routes/v1/receivables.ts)
  └── map new ReceivableError codes → 409
```

```
Seller write (create | create-and-submit | PATCH draft | submit)
  → build / merge receivableMetaData
  → normalize identifying fields (domain)
  → derive materialized business keys (domain)
  → skip guard for keys that normalize to null (FR incomplete metadata — OQ-6)
  → assertNoActiveReceivableDuplicate (application — exclude self on update/submit)
  → INSERT / UPDATE receivables (+ materialized columns)
  → on DB unique violation → map to duplicate_* error (409)
```

---

## Component design

### 1. Business key definition — domain normalization

**File:** `src/domain/receivable/businessKey.ts` *(new)*

**FR coverage:** FR-1, FR-5, FR-6, FR-7, FR-10.

Define two **independent** business keys per seller, enforced only when the normalized field is non-null:

| Key | Columns | When enforced |
| --- | ------- | ------------- |
| Bill identity | `(sellerId, normalizedBillNumber)` | `billNumber` present and non-empty after normalization |
| Fiscal identity | `(sellerId, normalizedFiscalDocumentKey)` | `fiscalDocumentKey` present and non-empty after normalization |

```typescript
import type { ReceivableMetaData } from "./types.js";
import { RECEIVABLE_STATUS, type ReceivableStatus } from "./transitions.js";

/** Statuses that block a duplicate for the same business key (FR-7). */
export const DUPLICATE_BLOCKING_STATUSES: readonly ReceivableStatus[] = [
  RECEIVABLE_STATUS.CREATED,
  RECEIVABLE_STATUS.UNDER_REVIEW,
  RECEIVABLE_STATUS.OFFER,
  RECEIVABLE_STATUS.APPROVED,
  RECEIVABLE_STATUS.CONFIRMED,
  RECEIVABLE_STATUS.PROCESSING,
  RECEIVABLE_STATUS.COMPLETED,
  RECEIVABLE_STATUS.OVERDUE,
] as const;

/** Terminal for duplicate purposes — resubmission allowed (FR-6). */
export const DUPLICATE_TERMINAL_STATUSES: readonly ReceivableStatus[] = [
  RECEIVABLE_STATUS.REPROVED,
  RECEIVABLE_STATUS.REJECTED,
  RECEIVABLE_STATUS.PAYER_REJECTED,
  RECEIVABLE_STATUS.PAYER_SETTLED,
] as const;

export function isDuplicateBlockingStatus(status: string): boolean {
  return (DUPLICATE_BLOCKING_STATUSES as readonly string[]).includes(status);
}

/** Trim + uppercase — avoids casing/whitespace bypass (OQ-2). */
export function normalizeBillNumber(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * NF-e / NFC-e / NFS-e access keys → digits-only (44 chars).
 * fiscalDocumentType = 'other' → trim only (alphanumeric doc numbers) (OQ-3).
 */
export function normalizeFiscalDocumentKey(
  raw: string,
  fiscalDocumentType?: ReceivableMetaData["fiscalDocumentType"],
): string {
  const trimmed = raw.trim();
  if (fiscalDocumentType === "other") return trimmed;
  return trimmed.replace(/\D/g, "");
}

export type MaterializedBusinessKeys = {
  normalizedBillNumber: string | null;
  normalizedFiscalDocumentKey: string | null;
};

/** Returns null for each key when source field is missing or empty after normalization (OQ-6). */
export function deriveMaterializedBusinessKeys(
  meta: Partial<ReceivableMetaData> | null | undefined,
): MaterializedBusinessKeys {
  if (!meta) {
    return { normalizedBillNumber: null, normalizedFiscalDocumentKey: null };
  }

  let normalizedBillNumber: string | null = null;
  if (meta.billNumber && meta.billNumber.trim() !== "") {
    normalizedBillNumber = normalizeBillNumber(meta.billNumber);
  }

  let normalizedFiscalDocumentKey: string | null = null;
  if (meta.fiscalDocumentKey && meta.fiscalDocumentKey.trim() !== "") {
    normalizedFiscalDocumentKey = normalizeFiscalDocumentKey(
      meta.fiscalDocumentKey,
      meta.fiscalDocumentType,
    );
  }

  return { normalizedBillNumber, normalizedFiscalDocumentKey };
}

/** Apply normalization into metadata before JSON persistence (FR-5). */
export function normalizeReceivableMetaDataForStorage(
  meta: Partial<ReceivableMetaData>,
): Partial<ReceivableMetaData> {
  const out = { ...meta };
  if (out.billNumber !== undefined && out.billNumber.trim() !== "") {
    out.billNumber = normalizeBillNumber(out.billNumber);
  }
  if (out.fiscalDocumentKey !== undefined && out.fiscalDocumentKey.trim() !== "") {
    out.fiscalDocumentKey = normalizeFiscalDocumentKey(
      out.fiscalDocumentKey,
      out.fiscalDocumentType,
    );
  }
  if (out.payerCnpj !== undefined) {
    out.payerCnpj = out.payerCnpj.replace(/\D/g, "");
  }
  return out;
}
```

**Decision (FR-1 / OQ-1):** Both keys are enforced **independently** when present. A collision on either dimension blocks the write. This matches risk expectations: the same NF-e access key or the same duplicata number cannot be in flight twice for one seller.

---

### 2. Error codes

**File:** `src/domain/receivable/errors.ts`

**FR coverage:** FR-4.

```typescript
export const RECEIVABLE_ERROR_CODES = {
  // ... existing codes ...
  DUPLICATE_BILL_NUMBER: "duplicate_bill_number",
  DUPLICATE_FISCAL_KEY: "duplicate_fiscal_document_key",
} as const;
```

Granular codes (OQ-4) let the frontend show field-specific messages. The application guard throws `DUPLICATE_BILL_NUMBER` or `DUPLICATE_FISCAL_KEY` depending on which dimension collided. If both collide (rare), prefer `duplicate_bill_number` (deterministic first check).

---

### 3. Application duplicate guard

**File:** `src/application/receivable/duplicateGuard.ts` *(new)*

**FR coverage:** FR-2, FR-3, FR-8, FR-10.

Mirror `registerSellerWalletCommand.ts`: query before write, throw domain error; DB index is backstop only.

```typescript
import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";

import type { AppDeps } from "../deps.js";
import { receivables } from "../../db/schema.runtime.js";
import type { MaterializedBusinessKeys } from "../../domain/receivable/businessKey.js";
import { DUPLICATE_BLOCKING_STATUSES } from "../../domain/receivable/businessKey.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../domain/receivable/errors.js";

export type AssertNoDuplicateInput = {
  sellerId: string;
  keys: MaterializedBusinessKeys;
  excludeReceivableId?: string;
};

export async function assertNoActiveReceivableDuplicate(
  deps: AppDeps,
  input: AssertNoDuplicateInput,
): Promise<void> {
  const { normalizedBillNumber, normalizedFiscalDocumentKey } = input.keys;
  if (!normalizedBillNumber && !normalizedFiscalDocumentKey) return;

  const conditions = [
    eq(receivables.sellerId, input.sellerId),
    isNull(receivables.deletedAt),
    inArray(receivables.status, [...DUPLICATE_BLOCKING_STATUSES]),
  ];
  if (input.excludeReceivableId) {
    conditions.push(ne(receivables.id, input.excludeReceivableId));
  }

  const keyMatch = or(
    normalizedBillNumber
      ? eq(receivables.normalizedBillNumber, normalizedBillNumber)
      : undefined,
    normalizedFiscalDocumentKey
      ? eq(receivables.normalizedFiscalDocumentKey, normalizedFiscalDocumentKey)
      : undefined,
  );
  if (!keyMatch) return;

  const [collision] = await deps.db
    .select({
      id: receivables.id,
      normalizedBillNumber: receivables.normalizedBillNumber,
      normalizedFiscalDocumentKey: receivables.normalizedFiscalDocumentKey,
    })
    .from(receivables)
    .where(and(...conditions, keyMatch))
    .limit(1);

  if (!collision) return;

  if (
    normalizedBillNumber &&
    collision.normalizedBillNumber === normalizedBillNumber
  ) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.DUPLICATE_BILL_NUMBER);
  }
  throw new ReceivableError(RECEIVABLE_ERROR_CODES.DUPLICATE_FISCAL_KEY);
}

export function isReceivableUniqueViolation(error: unknown): "bill" | "fiscal" | null {
  if (!(error instanceof Error)) return null;
  const msg = error.message.toLowerCase();
  if (!msg.includes("unique") && !msg.includes("constraint")) return null;
  if (msg.includes("receivables_seller_bill_active_unique")) return "bill";
  if (msg.includes("receivables_seller_fiscal_key_active_unique")) return "fiscal";
  return "bill"; // fallback when driver omits index name
}
```

**Query performance:** Indexed on `(seller_id, normalized_bill_number)` and `(seller_id, normalized_fiscal_document_key)` via partial unique indexes. Single-row `LIMIT 1` lookup — O(1) with index.

---

### 4. Wire guard into write commands

**Files:** all four seller write commands + `receivableHelpers.ts`

**FR coverage:** FR-3, FR-5, FR-8.

#### 4a. `receivableHelpers.ts`

Extend metadata persistence to always normalize identifying fields and expose materialized column values for inserts/updates:

```typescript
import {
  deriveMaterializedBusinessKeys,
  normalizeReceivableMetaDataForStorage,
} from "../../domain/receivable/businessKey.js";

export function prepareReceivableMetaDataForWrite(
  meta: Partial<ReceivableMetaData>,
): { receivableMetaData: string; materializedKeys: MaterializedBusinessKeys } {
  const normalized = normalizeReceivableMetaDataForStorage(metaApiToStored(meta));
  return {
    receivableMetaData: JSON.stringify(normalized),
    materializedKeys: deriveMaterializedBusinessKeys(normalized),
  };
}
```

Update `stringifyReceivableMetaData` to delegate to `normalizeReceivableMetaDataForStorage` so all paths persist normalized values.

#### 4b. `createReceivableCommand.ts`

```typescript
// After building meta, before insert:
const { receivableMetaData, materializedKeys } = input.receivableMetaData !== undefined
  ? prepareReceivableMetaDataForWrite({ ...meta, payerCnpj: input.payerCnpj.replace(/\D/g, "") })
  : { receivableMetaData: null, materializedKeys: deriveMaterializedBusinessKeys(null) };

await assertNoActiveReceivableDuplicate(deps, {
  sellerId: seller.id,
  keys: materializedKeys,
});

try {
  await deps.db.insert(receivables).values({
    // ...existing fields...
    receivableMetaData,
    normalizedBillNumber: materializedKeys.normalizedBillNumber,
    normalizedFiscalDocumentKey: materializedKeys.normalizedFiscalDocumentKey,
  });
} catch (error) {
  const violation = isReceivableUniqueViolation(error);
  if (violation === "bill") throw new ReceivableError(RECEIVABLE_ERROR_CODES.DUPLICATE_BILL_NUMBER);
  if (violation === "fiscal") throw new ReceivableError(RECEIVABLE_ERROR_CODES.DUPLICATE_FISCAL_KEY);
  throw error;
}
```

#### 4c. `createAndSubmitReceivableCommand.ts`

Same as create: metadata is complete; run guard on derived keys; insert with `status = under_review` and materialized columns.

#### 4d. `updateReceivableDraftCommand.ts`

```typescript
const merged = input.receivableMetaData !== undefined
  ? { ...existing, ...metaApiToStored(input.receivableMetaData) }
  : existing;

const { receivableMetaData, materializedKeys } = input.receivableMetaData !== undefined
  ? prepareReceivableMetaDataForWrite(merged)
  : {
      receivableMetaData: row.receivableMetaData,
      materializedKeys: deriveMaterializedBusinessKeys(parseReceivableMetaData(row.receivableMetaData)),
    };

// Guard when metadata patch may set/change identifying fields (FR-3)
if (input.receivableMetaData !== undefined) {
  await assertNoActiveReceivableDuplicate(deps, {
    sellerId: row.sellerId,
    keys: materializedKeys,
    excludeReceivableId: input.receivableId, // FR-8
  });
}

await deps.db.update(receivables).set({
  receivableMetaData,
  normalizedBillNumber: materializedKeys.normalizedBillNumber,
  normalizedFiscalDocumentKey: materializedKeys.normalizedFiscalDocumentKey,
  // ...value, updatedAt...
});
```

#### 4e. `submitReceivableCommand.ts`

Submit does not change metadata but must still block if another active receivable shares the same key (FR-3):

```typescript
const meta = assertReceivableMetaDataComplete(row.receivableMetaData);
const keys = deriveMaterializedBusinessKeys(meta);

await assertNoActiveReceivableDuplicate(deps, {
  sellerId: row.sellerId,
  keys,
  excludeReceivableId: input.receivableId,
});

// then transition created → under_review
```

---

### 5. Database migration — materialized columns + partial unique indexes

**Files:** `src/db/schema.ts`, `src/db/schema.pg.ts`, `drizzle/0008_receivable_duplicate_guard.sql`

**FR coverage:** FR-9.

Add nullable materialized columns (null = key not applicable / incomplete draft):

```typescript
export const receivables = sqliteTable(
  "receivables",
  {
    // ...existing columns...
    normalizedBillNumber: text("normalized_bill_number"),
    normalizedFiscalDocumentKey: text("normalized_fiscal_document_key"),
  },
  (t) => [
    // ...existing indexes...
    index("receivables_seller_bill_idx").on(t.sellerId, t.normalizedBillNumber),
    index("receivables_seller_fiscal_key_idx").on(t.sellerId, t.normalizedFiscalDocumentKey),
    uniqueIndex("receivables_seller_bill_active_unique")
      .on(t.sellerId, t.normalizedBillNumber)
      .where(
        sql`${t.deletedAt} IS NULL
          AND ${t.normalizedBillNumber} IS NOT NULL
          AND ${t.status} IN ('created','under_review','offer','approved','confirmed','processing','completed','overdue')`,
      ),
    uniqueIndex("receivables_seller_fiscal_key_active_unique")
      .on(t.sellerId, t.normalizedFiscalDocumentKey)
      .where(
        sql`${t.deletedAt} IS NULL
          AND ${t.normalizedFiscalDocumentKey} IS NOT NULL
          AND ${t.status} IN ('created','under_review','offer','approved','confirmed','processing','completed','overdue')`,
      ),
  ],
);
```

Mirror identically in `schema.pg.ts` (Postgres canonical).

**Migration steps (`0008_receivable_duplicate_guard.sql`):**

1. `ALTER TABLE receivables ADD COLUMN normalized_bill_number TEXT;`
2. `ALTER TABLE receivables ADD COLUMN normalized_fiscal_document_key TEXT;`
3. Backfill from existing `receivable_meta_data` JSON using the same normalization rules (one-time SQL or a small Node script run as part of migration review). Rows with missing/empty identifying fields remain `NULL`.
4. Create non-unique lookup indexes on `(seller_id, normalized_bill_number)` and `(seller_id, normalized_fiscal_document_key)`.
5. Create partial unique indexes matching active status list.

**Pre-migration note:** If production already contains duplicate active rows for the same seller + key, step 5 will fail. Per PRD out-of-scope, ops must resolve existing duplicates manually before deploying. No automatic merge.

Soft-deleted rows (`deleted_at IS NOT NULL`) are excluded from both indexes and application queries (FR-2, FR-9).

---

### 6. HTTP error mapping

**File:** `src/routes/v1/receivables.ts`

**FR coverage:** FR-4.

```typescript
const RECEIVABLE_ERROR_HTTP: Partial<Record<ReceivableErrorCode, number>> = {
  // ...existing...
  [RECEIVABLE_ERROR_CODES.DUPLICATE_BILL_NUMBER]: 409,
  [RECEIVABLE_ERROR_CODES.DUPLICATE_FISCAL_KEY]: 409,
};
```

Response shape unchanged: `{ error: "<code>" }`.

---

## Data flow

```
POST /v1/receivables
  → Zod (createBodySchema)
  → executeCreateReceivable
      → normalize metadata + derive keys
      → assertNoActiveReceivableDuplicate
      → INSERT (status=created, materialized columns)
  → 201 { id } | 409 { error: duplicate_* }

POST /v1/receivables/submit
  → executeCreateAndSubmitReceivable (same guard, status=under_review)

PATCH /v1/receivables/:id
  → executeUpdateReceivableDraft
      → merge metadata → normalize → guard (exclude self) → UPDATE

POST /v1/receivables/:id/submit
  → executeSubmitReceivable
      → assertReceivableMetaDataComplete
      → guard on existing keys (exclude self)
      → UPDATE status → under_review
```

---

## Files changed

| File | Change type |
|------|-------------|
| `src/domain/receivable/businessKey.ts` | Added |
| `src/domain/receivable/errors.ts` | Modified |
| `src/application/receivable/duplicateGuard.ts` | Added |
| `src/application/receivable/receivableHelpers.ts` | Modified |
| `src/application/receivable/commands/createReceivableCommand.ts` | Modified |
| `src/application/receivable/commands/createAndSubmitReceivableCommand.ts` | Modified |
| `src/application/receivable/commands/updateReceivableDraftCommand.ts` | Modified |
| `src/application/receivable/commands/submitReceivableCommand.ts` | Modified |
| `src/db/schema.ts` | Modified |
| `src/db/schema.pg.ts` | Modified |
| `drizzle/0008_receivable_duplicate_guard.sql` | Added |
| `src/routes/v1/receivables.ts` | Modified |
| `tests/domain/receivable/businessKey.test.ts` | Added |
| `tests/application/receivable/duplicateGuard.test.ts` | Added |
| `tests/application/receivable/createReceivableCommand.test.ts` | Modified |
| `tests/application/receivable/createAndSubmitReceivableCommand.test.ts` | Modified |
| `tests/application/receivable/updateReceivableDraftCommand.test.ts` | Modified |
| `tests/application/receivable/submitReceivableCommand.test.ts` | Modified |
| `tests/routes/v1/receivableRoutes.test.ts` | Modified (or new duplicate-focused cases) |

---

## Impact analysis

- **API compatibility:** Non-breaking. Existing success responses unchanged. New `409` responses on duplicate attempts (`duplicate_bill_number`, `duplicate_fiscal_document_key`).
- **Database:** Migration adds two nullable columns + two partial unique indexes on `receivables`. Backfill required for existing rows with metadata.
- **Performance:** Single indexed lookup per guard invocation. No N+1. Partial indexes keep uniqueness scope small (active statuses only).
- **Other modules:** None. Guard applies only to seller write commands; system/internal transitions and risk-analyst routes untouched.
- **Cross-seller:** Same `billNumber` / `fiscalDocumentKey` for different sellers remains allowed (FR-10) — indexes include `seller_id`.

---

## Test strategy

### Unit — `businessKey`

| Scenario | Input | Expected |
|----------|-------|----------|
| Bill number trim + uppercase | `" dup-001 "` | `"DUP-001"` |
| Fiscal key digits-only (nfe) | `"3521...-55"` + `nfe` | 44 digits, no punctuation |
| Fiscal key other type | `" DOC-99/x "` + `other` | `"DOC-99/x"` (trimmed) |
| Empty billNumber | `""` or missing | `normalizedBillNumber: null` — guard skipped |
| Active vs terminal status | `reproved`, `completed` | `isDuplicateBlockingStatus` true/false respectively |

### Unit — `duplicateGuard`

| Scenario | Input | Expected |
|----------|-------|----------|
| No keys | both null | no throw |
| Active collision bill | same seller + bill, status `under_review` | `duplicate_bill_number` |
| Terminal prior receivable | same key, status `reproved` | no throw |
| Exclude self | update same draft | no throw |
| Different seller | same billNumber | no throw |
| Soft-deleted collision | deletedAt set | no throw |

### Integration — write commands

- Create draft with `billNumber` → second create with same normalized bill → `409 duplicate_bill_number`.
- Create with `fiscalDocumentKey` only → duplicate fiscal key blocked.
- Create after terminal `reproved` receivable with same keys → succeeds.
- PATCH draft changing `billNumber` to collide with another active receivable → `409`.
- PATCH draft updating unrelated field → no duplicate query when identifying fields unchanged.
- Submit draft whose keys collide with another active receivable → `409`.
- POST create-and-submit with duplicate complete metadata → `409`.
- Whitespace/casing variant (`"abc-1"` vs `" ABC-1 "`) → blocked as duplicate.
- Concurrent duplicate inserts: one succeeds, second gets application `409` or DB constraint mapped to `409`.

### API / E2E

- `POST /v1/receivables` duplicate → `409` + `{ error: "duplicate_bill_number" }`.
- Same for `/v1/receivables/submit`, `PATCH /v1/receivables/:id`, `POST /v1/receivables/:id/submit`.

---

## Observability

- **Logs:** No new info-level logs on happy path. On duplicate detection, existing Fastify request logging suffices; do **not** log full `billNumber` / `fiscalDocumentKey` at info (PII/commercial sensitivity). Optional debug-level log with receivable id + error code only.
- **Error handling:** Application guard throws `ReceivableError` → route maps to `409`. Uncaught DB unique violation on insert/update → `isReceivableUniqueViolation` maps to same codes. Unexpected errors propagate as 500.

---

## Open questions resolved

| Question (from PRD) | Decision |
|---------------------|----------|
| **OQ-1:** Authoritative business key — billNumber, fiscalDocumentKey, or both? | **Both enforced independently** when the normalized field is non-null. Two partial unique indexes. |
| **OQ-2:** `billNumber` case normalization? | **Trim + uppercase** before compare and persistence. |
| **OQ-3:** `fiscalDocumentKey` normalization? | **Digits-only** for `nfe` / `nfce` / `nfse`; **trim only** for `other`. |
| **OQ-4:** Single vs granular error codes? | **Granular:** `duplicate_bill_number` and `duplicate_fiscal_document_key` (HTTP 409). |
| **OQ-5:** Is `overdue` active or terminal? | **Active** — blocks duplicate resubmission while obligation is outstanding (aligns with FR-7). |
| **OQ-6:** Incomplete metadata — skip or reject? | **Skip guard** for keys that normalize to null. Guard runs when a non-null normalized key would be written or is already on the row at submit time. |
