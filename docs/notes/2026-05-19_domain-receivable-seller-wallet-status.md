# Domain sketch — status lifecycles (receivable, seller, wallet)

**Date:** 2026-05-19  
**Status:** product / domain reference for **seller** and **wallet** sketches; **receivable** lifecycle for implementation is **normative** in [`2026-05-19_platform-auth-rbac-receivable-v1.md`](2026-05-19_platform-auth-rbac-receivable-v1.md) (differs from the first sketch: **no seller `approved`** after `offer` in v1).  
**Source:** hand-drawn diagram titled **“status”** (see [`../assets/domain-status-lifecycle-sketch.png`](../assets/domain-status-lifecycle-sketch.png)).

**See also:** [`2026-05-19_domain-actor-entity-interactions.md`](2026-05-19_domain-actor-entity-interactions.md); conceptual tables — [`2026-05-19_domain-tables-sketch.md`](2026-05-19_domain-tables-sketch.md); providers — [`2026-05-19_domain-providers-sketch.md`](2026-05-19_domain-providers-sketch.md); **v1 auth + receivable RBAC** — [`2026-05-19_platform-auth-rbac-receivable-v1.md`](2026-05-19_platform-auth-rbac-receivable-v1.md).

---

## How to read the diagram

- Each **diamond** is an **entity**; **circles** are **status values**.
- **Dashed boxes** group statuses by **who drives** that state (seller, agent/risk analyst, payer, platform), not necessarily by strict chronological order.
- The drawing is a **sketch**: exact transition rules (guards, who can call what, parallel vs sequential) need to be specified when implementing.

---

## 1. Receivables

> **Implement v1 from:** [`2026-05-19_platform-auth-rbac-receivable-v1.md`](2026-05-19_platform-auth-rbac-receivable-v1.md) (JWT humans, API key server-server, roles, and **system-only** `processing` / `completed`).

The table below is the **original sketch** interpretation; **v1 happy path** is  
**create → `under_review`** (one write, no persisted `created` status — use **`created_at`** + **`updated_at`**) → `offer` → `confirmed` → `processing` → `completed`  
(**no** seller `approved` after offer).

| Status (sketch label) | Driven by (sketch) | v1 / notes |
|------------------------|--------------------|------------|
| `created` | Seller | **Not a persisted status in v1** — creation lands in **`under_review`**; “created” is **`created_at`**. |
| `under review` | Seller | **Initial status** after seller **create** (single API). |
| `offer` | Agent / risk analyst | Duplicata accepted; **discount / diságio proposal** recorded. |
| `repproved` | Agent / risk analyst | Rejected (spelling **“repproved”** in sketches — canonical API value may be `rejected`). |
| `approved` | Seller | **Omitted in v1** product rules; kept here only as historical sketch artifact. |
| `confirmed` | Payer | Payer confirms discounting the duplicata and paying Dupply. |
| `processing` | Platform | **No end-user transition** — only **system** / jobs. |
| `completed` | Platform | **No end-user transition** — terminal success after liquidation. |

**Branch:** after review, **`offer` OR `repproved`**.

**Implementation hint:** model as a **single receivable status enum** with **explicit transition rules** and audit; enforce in application/domain, not only in routes.

---

## 2. Seller (onboarding / account)

| Status | Driven by | Meaning (interpretation) |
|--------|-----------|---------------------------|
| `created` | Seller | Registered, not yet cleared by risk. |
| `active` | Agent / risk analyst | Verified and enabled. |
| `inactive` | Agent / risk analyst | Disabled / suspended. |

**Inferred flow:** `created` → `active` or `inactive` (with possible `active` ↔ `inactive` later — not drawn).

---

## 3. Wallet abstraction

| Status | Notes |
|--------|--------|
| `active` | Wallet usable for operations. |
| `inactive` | Wallet blocked / not in use. |

**Context on the diagram:** handwritten note **“seller approved first sign in”** — interpreted as: **wallet activation is tied to seller being approved and completing first sign-in** (or equivalent onboarding gate), then the wallet sits in `active` / `inactive` like the seller account.

---

## Relation to this repository (today)

- `src/db/schema.ts` uses **string `status` columns** with defaults such as `active`, `created`, `draft` on different tables — **not yet** aligned 1:1 with this receivable lifecycle.
- **Trade bill** (Soroban + HTTP) is a separate bounded context; mapping **receivable** statuses to trade-bill states (if any) is **TBD** when product defines a single lifecycle vs split models.

---

## Rollback

Remove this file and [`../assets/domain-status-lifecycle-sketch.png`](../assets/domain-status-lifecycle-sketch.png) if the sketch is superseded.
