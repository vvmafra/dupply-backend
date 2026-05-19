# Research: Stellar anchors, SEPs, and Anchor Platform (context for backend v1)

**Date:** 2026-05-16  
**Goal:** Clarify what Stellar documentation calls an **anchor**, which **SEPs** matter for fiat↔crypto ramps, and how that relates to (and **differs** from) integrations such as **Etherfuse FX API**.  
**Official sources (priority):** [Stellar Developers](https://developers.stellar.org/docs), [Anchor Platform / SEP-24](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started), [Wallet SEP-24](https://developers.stellar.org/docs/build/apps/wallet/sep24), [Anchor Directory](https://anchors.stellar.org/).

---

## 1. Stellar glossary: what is an “anchor”

In the Stellar ecosystem, an **anchor** is, in simple terms, an entity that **issues assets** on the network and/or runs **on/off-ramps** (deposit and withdrawal between banking/fiat and the ledger), usually in a **standardized** way via **Stellar Ecosystem Proposals (SEPs)**.

Do not confuse with:

- **Anchor** in the machine-learning *framework* sense (different domain).  
- **“Integrating an Anchor”** in the Dupply product: it can mean (a) consuming a **ramp provider** with a proprietary API (e.g. Etherfuse), or (b) integrating a **classic SEP-10 + SEP-24** anchor listed in the directory, or (c) both, in separate phases.

---

## 2. SEPs relevant to “hosted” ramps (integrator view)

### SEP-24 — Hosted deposit and withdrawal

- Describes a flow where the client interacts with a **URL** hosted by the anchor after authentication.  
- Documentation: [Hosted Deposit and Withdrawal](https://developers.stellar.org/docs/build/apps/wallet/sep24), [SEP-24 getting started (Anchor Platform)](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started), [Integration guide](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration).

Simplified flow (off-ramp, conceptual summary):

1. User picks an asset and the wallet finds the anchor.  
2. Authentication with the anchor (typically **SEP-10**).  
3. Wallet opens the anchor’s interactive URL.  
4. User confirms details; wallet sends the asset on Stellar to the anchor’s distribution account.  
5. Anchor processes the bank transfer (or equivalent).

### SEP-10 — Web authentication

Used so the anchor can prove the user controls the Stellar account before opening a SEP-24 session. See prerequisites in [SEP-24 getting started](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started).

### SEP-1 — stellar.toml

Anchor discovery file (domain, assets, authentication URLs, etc.). Typical prerequisite for “directory + wallet” integrations.

### SEP-38 (FX scope)

Mentioned in integration docs for **quotes** when converting between non-equivalent assets. See [integration](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration).

### SEP-45 (mentioned in current docs)

*Getting started* references **SEP-45** in the context of *Stellar Web Authentication for contract account* — relevant if the user is a **contract account (Soroban)** instead of only a classic `G...` account. This affects Dupply design if the “seller” operates via a **smart wallet**.

---

## 3. Anchor Platform (Stellar)

This is the SDF’s reference stack for operators who want to **run** an anchor with SEP standards (JSON-RPC events, JWT, etc.). For Dupply as an **application** that *consumes* ramps, the common cases are:

- integrate as a **SEP-24 client** / wallet / server that orchestrates links; **or**  
- integrate a **third-party API** (Etherfuse) that already bundles KYC, quotes, and orders.

Documentation: [Anchor Platform](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started).

---

## 4. Anchor Directory

Public list of anchors and metadata: [https://anchors.stellar.org/](https://anchors.stellar.org/).  
Useful to discover **who** supports **which** asset/country and to validate `stellar.toml` / endpoints.

---

## 5. Relationship to Soroban and the trade-bill registry (`duplicata-registry` crate)

- The current **Soroban** contract records **duplicatas** and does **not** implement a ramp.  
- A **ramp** (fiat↔stable or stable↔bank account) is, in practice, **off-chain + Stellar transactions** coordinated by a provider.  
- The v1 backend can:  
  - **Orchestrate** calls to an anchor (SEP-24 / Etherfuse API);  
  - **Persist** KYC/order state **in the DB**;  
  - **Submit** Stellar transactions signed by the user or by a relayer (depending on legal and technical model).

---

## 6. Selection criteria: “SEP-24 anchor” vs “Etherfuse API”

| Criterion | Classic anchor (SEP-24 + directory) | Etherfuse FX API |
|-----------|--------------------------------------|------------------|
| Discovery | `stellar.toml`, directory | Org account + Etherfuse docs |
| Ramp UX | SEP-24 hosted URL | Etherfuse hosted UI or API-only |
| Standardization | High (Stellar ecosystem) | Proprietary API (REST) |
| Assets / countries | Per anchor | Defined by Etherfuse (see API) |
| v1 effort | Higher (full SEP-10/24 flow) | Lower if the API covers your case |

**Documentation recommendation:** in v1, **pick one primary path** (Etherfuse *or* a specific SEP-24 anchor for BRL/USDC), record the decision in an ADR, and keep the backend’s internal interface as **`RailsProvider`** with two implementations in phase 2 if needed.

---

## 7. Next documents in this series

- `2026-05-16_etherfuse-stellar-fx-api.md` — Etherfuse product detail (press + FX API).  
- `../notes/2026-05-16_dupply-backend-v1-plan.md` — v1 implementation plan including ramp integration.

---

## References (links)

1. Stellar Docs — Wallet: SEP-24 — https://developers.stellar.org/docs/build/apps/wallet/sep24  
2. Stellar Docs — Anchor Platform SEP-24 getting started — https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started  
3. Stellar Docs — SEP-24 integration — https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/integration  
4. Anchor Directory — https://anchors.stellar.org/
