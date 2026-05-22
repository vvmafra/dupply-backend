# Domain sketch — conceptual tables (“tables” diagram)

**Date:** 2026-05-19  
**Status:** product / domain reference (not a binding architecture decision).  
**Source:** hand-drawn diagram titled **“tables”** — [`../assets/domain-tables-sketch.png`](../assets/domain-tables-sketch.png).

**See also:**

- Actors ↔ entities — [`2026-05-19_domain-actor-entity-interactions.md`](2026-05-19_domain-actor-entity-interactions.md)  
- Status lifecycles — [`2026-05-19_domain-receivable-seller-wallet-status.md`](2026-05-19_domain-receivable-seller-wallet-status.md)  
- Providers (vendors) — [`2026-05-19_domain-providers-sketch.md`](2026-05-19_domain-providers-sketch.md)

---

## Core entities

### `seller`

| Field (sketch) | Notes |
|----------------|--------|
| `id` | Primary key. |
| `status` | Align with seller lifecycle in [`2026-05-19_domain-receivable-seller-wallet-status.md`](2026-05-19_domain-receivable-seller-wallet-status.md). |
| `name`, `email`, `password` | Classic credential surface; prefer **password hash** only in a real schema, never plaintext. |
| `companyMD` | Interpreted as **company metadata** (JSON/blob). |
| `legalRepresentativeMD` | **Legal representative** metadata. |
| `suppliersMD` | **Suppliers** metadata. |

### `payer`

| Field (sketch) | Notes |
|----------------|--------|
| `id` | Primary key. |
| `legalName`, `email`, `CNPJ` | Brazilian corporate payer identity. |
| `receivableId` | **FK to receivable** — ambiguous vs `receivable.payerId`: product must clarify **1:1 payer–receivable** vs **many receivables per payer** (diagram suggests a direct link from payer row to one receivable; may be a simplification). |

### `receivable`

| Field (sketch) | Notes |
|----------------|--------|
| `id` | Primary key. |
| `status` | Align with receivable lifecycle in [`2026-05-19_domain-receivable-seller-wallet-status.md`](2026-05-19_domain-receivable-seller-wallet-status.md). |
| `sellerId`, `payerId` | FKs — **receivable** is the hub between seller and payer. |
| `receivableMD` | Extra metadata (JSON/blob). |
| `value` | Nominal / face value (semantics TBD). |
| `proposedValue` | Offer-side amount (ties to risk **offer** state). |

---

## Shared / polymorphic tables

### `documents`

| Field | Notes |
|-------|--------|
| `id` | Primary key. |
| `parentType`, `parentId` | **Polymorphic** attachment to seller, receivable, payer, etc. |
| `URL` | Stored file location (prefer **object key + bucket** or signed URL strategy in implementation). |

### `wallet`

| Field | Notes |
|-------|--------|
| `id` | Primary key. |
| `status` | Align with wallet lifecycle sketch. |
| `parentType`, `parentId` | **Polymorphic** owner (e.g. seller, platform admin). |
| `network` | Chain / network identifier. |
| `seed` | **Security:** storing a **raw seed phrase or secret key** in a relational table is **high risk** and usually **rejected** in production designs; prefer HSM, custodian, MPC, or **public address + external custody** only. Treat this field as **diagram placeholder** until a vetted key-management approach is chosen. |

---

## Admin and risk roles

### `risk analyst`

Same shape as seller for credentials: `id`, `status`, `name`, `email`, `password` (again: **hash**, not plaintext).

### `admin`

Same pattern as risk analyst.

### `agent risk analyst`

Diagram: **TBD** — no columns yet (automation / service account / mapping table deferred).

### `audit log`

Diagram: **TBD** — append-only events, actor, entity, before/after, etc., to be specified.

---

## Relation to this repository (today)

[`src/db/schema.ts`](../../src/db/schema.ts) currently defines **Ramp** (`ramp_quotes`, `ramp_orders`) and **Trade bill** (`trade_bill_drafts`, `trade_bill_chain_records`) only. **None** of the sketch tables above exist in Drizzle yet; integrating them will require migrations and clear boundaries vs **trade bill** (same receivable lifecycle or separate bounded context).

---

## Rollback

Remove this file and [`../assets/domain-tables-sketch.png`](../assets/domain-tables-sketch.png) if superseded.
