# Domain sketch — actors → entities (interactions diagram)

**Date:** 2026-05-19  
**Status:** product / domain reference (not a binding architecture decision).  
**Source:** hand-drawn “interactions” diagram shared in session (actors and entities with arrows).

---

## Actors

| Actor | Role in this sketch |
|--------|---------------------|
| **Seller** | Originates receivables; holds user-side funds (wallet). |
| **Payer** | Counterparty to receivables (payment / settlement side in the diagram). |
| **Admin** | Platform operator; associated with **platform wallet**. |
| **Risk analyst** (human) | Reviews risk on accounts and receivables. |
| **Risk analyst agent** | Automated / assisted risk touch on the same objects as the analyst. |

---

## Entities (nodes in the diagram)

| Entity | Notes |
|--------|--------|
| **KYC** | Identity / compliance; linked from seller and admin in the sketch. |
| **Account** | User or party account; touched by seller, admin, and risk (human + agent). |
| **Wallet** | Seller’s wallet (user-controlled or user-scoped balance). |
| **Platform wallet** | Admin / platform custody of funds. |
| **Receivables** | Central hub in the drawing: **all listed actors connect to receivables** (seller, payer, admin, risk analyst, risk analyst agent). |

---

## Access pattern (how to read the arrows)

- **Receivables** is the **core domain object** in this map: every actor has at least one relation to it.
- **KYC** and **account** support **onboarding and identity**; **wallet** vs **platform wallet** split **user vs platform** custody.
- **Payer** is shown **narrowly** in this diagram (receivables only), not necessarily the full future product surface.
- **Risk** (human + agent) touches **account** and **receivables** — underwriting / monitoring across identity and obligations.

---

## Relation to this repository (today)

This sketch is **ahead of** or **orthogonal to** the current backend schema, which today emphasizes **ramp** (quotes / orders) and **trade bill** (drafts, chain, Soroban). When the user provides **table / entity lists**, reconcile:

- `src/db/schema.ts` — Drizzle tables and enums  
- Soroban **trade bill** model — on-chain representation vs off-chain receivable lifecycle  

Use this note as the **canonical text capture** of the diagram until a versioned image is stored under `docs/` (optional follow-up).

**See also:** status lifecycles — [`2026-05-19_domain-receivable-seller-wallet-status.md`](2026-05-19_domain-receivable-seller-wallet-status.md); conceptual tables — [`2026-05-19_domain-tables-sketch.md`](2026-05-19_domain-tables-sketch.md); providers — [`2026-05-19_domain-providers-sketch.md`](2026-05-19_domain-providers-sketch.md).

---

## Rollback

Remove or archive this file if the domain model is superseded by a newer canonical doc.
