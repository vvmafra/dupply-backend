# Research: Etherfuse, Stellar, and FX API (ramp / exchange)

**Date:** 2026-05-16  
**Goal:** Document what **Etherfuse** is in the **Stellar** context, the **FX API** (REST) product, and how it compares to classic **SEP-24 anchors**.  
**Rigor note:** This file summarizes public documentation consulted on 2026-05-16; before production implementation, review **changelog** and **API contracts** in the official Etherfuse documentation.

---

## 1. Etherfuse and the Stellar network (business / press context)

### 1.1 Stellar announcement (Meridian 2025)

The **Stellar Development Foundation (SDF)** publicly announced that **Etherfuse** would join the Stellar network in 2025, focused on **Stablebonds** and real-world asset infrastructure on Stellar.

- **Source:** [Stellar.org — Press: Etherfuse to join Stellar network in 2025](https://stellar.org/press/etherfuse-to-join-stellar-network-in-2025-ceo-david-taylor-announces-at-the-stellar-meridian-conference-in-london)

### 1.2 What this does *not* automatically imply

A partnership / network integration announcement **does not** replace reading the **concrete API** your backend will call. For engineering, the source of truth is:

- Etherfuse technical documentation: [https://docs.etherfuse.com/](https://docs.etherfuse.com/)

---

## 2. FX API — overview (Etherfuse documentation)

The “Overview” documentation describes **FX API** as the interface for **organizations** to build **exchange** and **payment** experiences with:

- **Quotes** with a fixed price for a time window.  
- **Orders** that move funds between **Etherfuse** accounts and defined destinations (including, per product docs, **Stellar** in the settlement flow).

### 2.1 Domain concepts (mental model)

1. **Organization** — Etherfuse customer entity; groups users and keys.  
2. **API keys** — server-to-server authentication (never expose in the browser).  
3. **JWT / user session** — pattern described in the docs for flows where an end user authenticates in your app and the backend exchanges/validates tokens with Etherfuse (see “Authentication”).  
4. **Quotes** — quote request with currency pair, amounts, TTL.  
5. **Orders** — execution after quote acceptance; states and webhooks per documentation.

### 2.2 Sandbox environment

The documentation references a sandbox host for testing without real funds, for example:

- `https://api.sand.etherfuse.com` (confirm the exact resource base path in current docs).

**Project rule:** separate environment variables `ETHERFUSE_BASE_URL`, `ETHERFUSE_API_KEY`, `ETHERFUSE_ORG_ID` (illustrative names) for **sandbox** vs **production**.

### 2.3 Security

- **API keys** only on the **backend** (Dupply API), never in the frontend.  
- **Webhooks** signed or validated per Etherfuse specification (implement after reading the exact section in the docs).  
- **Idempotency** on order-creation endpoints (`Idempotency-Key` if the API supports it — verify in docs).

---

## 3. Etherfuse vs “SEP-24 anchor” (engineering comparison)

| Aspect | SEP-24 anchor (Stellar ecosystem) | Etherfuse FX API |
|--------|-------------------------------------|------------------|
| Standard | SEP-1, SEP-10, SEP-24, possibly SEP-38 | Proprietary REST + org auth |
| Discovery | `stellar.toml`, Anchor Directory | Etherfuse account + dashboard |
| Typical UX | Anchor-hosted URL | Etherfuse hosted UI *or* API-only flow |
| Stellar wallet | Tightly coupled to SEP flow | Depends on order design / Stellar settlement |
| Maintenance | Fewer vendors, more SEP code | Less SEP code, more single-vendor coupling |

**Conclusion for Dupply:** Etherfuse is a **ramp/exchange provider** with its own API; it is **not** automatically the same artifact as “a directory-listed Stellar anchor with SEP-24”, although both can play the role of **fiat↔asset on Stellar** in your product.

---

## 4. Fit with the trade-bill Soroban registry (`duplicata-registry` crate)

The current contract:

- Records **trade bill metadata** on chain (issuer, drawee, amounts, hashes, etc.).  
- Does **not** move fiat money.  
- Does **not** replace bank or ramp-provider KYC.

A coherent product flow would be:

1. **Off-chain / ramp:** user converts or deposits via **Etherfuse** (or an anchor) to obtain **USDC/XLM/stable** on Stellar.  
2. **On-chain:** user (or an authorized agent) calls `issue` on the **registry** to anchor the trade bill on chain.  
3. **Indexer:** correlates `DuplicataIssued` events with Etherfuse order IDs in your DB (optional but strong for audit).

---

## 5. Risks and open decisions

1. **Jurisdiction and licensing** — ramps involve compliance; validate with Etherfuse and legal counsel.  
2. **Testnet vs mainnet** — Dupply contract may be on testnet while Etherfuse sandbox validates flows; align **Stellar network** for the order with the **supported asset network**.  
3. **Soroban vs classic account** — if the user is only `C...` (contract), review SEP-45 / wallet limitations with classic SEP-24.  
4. **Vendor lock-in** — abstract `RailsProvider` in code behind a stable interface.

---

## References (links)

1. Stellar press — Etherfuse joins network (2025) — https://stellar.org/press/etherfuse-to-join-stellar-network-in-2025-ceo-david-taylor-announces-at-the-stellar-meridian-conference-in-london  
2. Etherfuse docs (overview) — https://docs.etherfuse.com/  
3. Stellar developers (anchors / SEP-24) — https://developers.stellar.org/docs/build/apps/wallet/sep24  
