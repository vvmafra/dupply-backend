# Domain sketch — third-party providers (“providers” diagram)

**Date:** 2026-05-19  
**Status:** product / vendor shortlist (**candidates**, not committed). Question marks in the sketch mean **under evaluation**.  
**Source:** hand-drawn diagram titled **“providers”** — [`../assets/domain-providers-sketch.png`](../assets/domain-providers-sketch.png).

**See also:** [`2026-05-19_domain-actor-entity-interactions.md`](2026-05-19_domain-actor-entity-interactions.md), [`2026-05-19_domain-receivable-seller-wallet-status.md`](2026-05-19_domain-receivable-seller-wallet-status.md), [`2026-05-19_domain-tables-sketch.md`](2026-05-19_domain-tables-sketch.md).

---

## Stack (top → bottom in the drawing)

| Capability (sketch) | Candidate vendor | Notes |
|---------------------|-------------------|--------|
| **Wallet custodian** | Fireblocks? | Institutional wallet / MPC-style custody; map to `wallet` / platform custody in domain notes. |
| **Bank** | Starkbank? | Brazilian banking / Pix-style rails (confirm product scope vs Starkbank’s APIs). |
| **KYC** | Sumsub? | Identity verification; maps to **KYC** in the interactions diagram. |
| **On/off ramp** | Etherfuse? | **Already in this codebase** for Ramp quotes/orders (`ramp_*` tables, provider default `etherfuse`). Internal research: [`../research/2026-05-16_etherfuse-stellar-fx-api.md`](../research/2026-05-16_etherfuse-stellar-fx-api.md). |
| **Receivable validator** | NFE.io? | Suggested validation of receivable / fiscal document authenticity (Brazil NF-e context — confirm with vendor docs and legal). |
| **Storage** | Supabase? | Object or file storage (e.g. `documents` in the tables sketch). |
| **DB** | Supabase? | Managed **PostgreSQL** if Supabase is chosen for DB; today this repo uses **SQLite + Drizzle** locally — migrating to Postgres would be a separate decision. |
| **Blockchain** | **Stellar** | Only row **without** “?” in the sketch → treated as **settled choice** for ledger. Smart contracts: **Soroban** (see [`soroban/`](../../soroban/) and trade-bill domain). |

---

## Official documentation (for due diligence, not endorsement)

Use vendor docs before integrating; links are entry points:

| Topic | Documentation |
|--------|----------------|
| Stellar (network, Horizon, Soroban) | [Stellar Developers](https://developers.stellar.org/) |
| Fireblocks | [Fireblocks Developer Hub](https://developers.fireblocks.com/) |
| Sumsub | [Sumsub API / docs](https://docs.sumsub.com/) |
| Starkbank | [Starkbank documentation](https://starkbank.com/docs) |
| Etherfuse | Confirm current developer portal from [Etherfuse](https://etherfuse.com/) (API details also summarized in repo research note above). |
| Supabase | [Supabase Docs](https://supabase.com/docs) (Database, Storage, Auth as applicable). |
| NFE.io | Use vendor’s official API/support site for **NF-e** validation scope and SLAs. |

---

## Risks and decisions (short)

- **Supabase for both DB and storage** simplifies ops but couples the stack; SQLite vs Postgres affects Drizzle migrations and deployment.
- **Fireblocks + Starkbank + Etherfuse** overlap on “money movement” — clarify boundaries (custody vs bank vs on-chain ramp).
- **NFE.io** vs in-house validation: legal and fiscal compliance must sign off, not only engineering.

---

## Rollback

Remove this file and [`../assets/domain-providers-sketch.png`](../assets/domain-providers-sketch.png) if superseded by a signed architecture decision (e.g. entry in `DECISIONS.md`).
