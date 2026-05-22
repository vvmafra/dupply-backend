# Platform auth, RBAC, and receivable lifecycle — v1 decisions

**Date:** 2026-05-19  
**Status:** **normative** product / architecture capture for v1 implementation (supersedes informal reading of the hand-drawn receivable sketch where it conflicts).  
**Visual:** updated receivable flow sketch — [`../assets/receivable-status-flow-sketch.png`](../assets/receivable-status-flow-sketch.png).

**See also:** [`2026-05-19_domain-receivable-seller-wallet-status.md`](2026-05-19_domain-receivable-seller-wallet-status.md) (original sketch + seller/wallet), [`2026-05-19_domain-tables-sketch.md`](2026-05-19_domain-tables-sketch.md).

---

## 1. Identity and login

| Decision | Detail |
|----------|--------|
| **Where login lives** | **Our backend** (sessions/JWT issued by Dupply, not delegated to a separate IdP in v1). |
| **Who counts as a user** | **People** (human accounts) and **service accounts** (automation, integrations, future **n8n** agent). |
| **Seller vs payer** | **Always different** identities (no single account holding both roles). |

---

## 2. HTTP authentication model

| Client type | Mechanism |
|-------------|-----------|
| **Server ↔ server** (BFF, workers, trusted callers) | Existing header **`X-Dupply-Api-Key`** + env **`DUPPLY_API_KEY`** (unchanged pattern). |
| **Human users** | **JWT** (or equivalent session token) issued by our backend after login. |

Service accounts may use **API keys** or **JWT** depending on implementation; humans use **JWT** as stated.

---

## 3. Closed role list (v1)

| Role | Notes |
|------|--------|
| `seller` | Creates receivables; early lifecycle transitions only (see §4). |
| `payer` | Confirms consent to discount the **duplicata** and commitment to pay Dupply (see §4). |
| `admin` | Platform operations (scope TBD per route). |
| `risk_analyst` | Human risk; chooses `offer` or `repproved` from `under review`. |
| `risk_analyst_agent` | v1 role reserved for **automation** (e.g. future **n8n** AI agent account); same privilege class as analyst for receivable branch **unless** later restricted by policy. |

RBAC matrices for **admin** vs **risk** beyond receivables remain **TBD** until routes exist.

---

## 4. Receivable status transitions (normative v1)

Statuses align with the sketch labels; **who may call each transition** is fixed below.

| Step | Status after | Who performs the transition |
|------|----------------|------------------------------|
| 1 | **`under_review`** | **Seller** — **single create** (`POST` or equivalent): the receivable is persisted **already** in `under_review`. There is **no** separate API step from `created` → `under_review`. |
| 2a | `offer` | **`risk_analyst` OR `risk_analyst_agent`** — accept duplicata and register **discount / diságio proposal**. |
| 2b | `repproved` | **`risk_analyst` OR `risk_analyst_agent`** — reject. |
| 3 | `confirmed` | **Payer** — confirms that Dupply may discount the duplicata and that **they will pay Dupply** (legal/ops wording final in copy, not in this doc). |
| 4 | `processing` | **System only** — **no human user**; settlement pipeline / jobs. |
| 5 | `completed` | **System only** — liquidation finished; terminal success. |

**Timestamps on create:** persist **`created_at`** (immutable, insert time) and **`updated_at`** (same instant on create, then bump on later transitions). That pair is enough for “when was it created?” without a dedicated `under_review_at` on day one. If product later needs explicit `entered_under_review_at`, it can mirror `created_at` for this flow.

**Explicit exclusions:**

- **`processing` and `completed`:** must **not** be callable by authenticated “business” users; only **internal code** (workers, scheduled jobs, state machine after external confirmations).
- **No seller `approved` step in v1** after `offer` (differs from the first hand-drawn “status” sketch, which showed seller `approved` between offer and confirmed). v1 goes **`offer` → `confirmed` (payer)** then automation.
- **`created` as a stored status:** not used on insert in v1 — first stored status is **`under_review`**. The word “created” in older sketches maps to **metadata** (`created_at`), not a separate lifecycle state.

**Terminal failure:** `repproved` (store as `rejected` or `repproved` in enum — pick one English canonical value in API; internal label can map).

---

## 5. Implementation hints (non-binding)

- **MVP settlement trigger:** `POST /v1/internal/receivables/:id/advance-settlement` with **`X-Dupply-Api-Key` only** (no JWT) — see [`2026-05-19_auth-rbac-mvp-implementation.md`](2026-05-19_auth-rbac-mvp-implementation.md). Replace with a **worker / queue** before production.
- Persist **audit log** entries: actor (`user_id` / `service_account_id` / `system`), role, `from_status`, `to_status`, timestamp, receivable id.
- Enforce transitions in **one place** (application service or domain guard) so HTTP handlers cannot skip checks.
- Separate **“caller is authenticated”** from **“caller may change this status”**.

---

## 6. Rollback

Archive or replace this file if product revises the receivable graph (e.g. reintroduces seller acceptance after offer).
