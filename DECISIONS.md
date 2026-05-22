# Architecture decisions — dupply-backend

Short log of decisions that affect repository design. Details and migration phases: see links in each entry.

---

## 2026-05-19 — Light CQRS and modular monolith in the API

**Decision:** Evolve code in **`src/`** (root HTTP API) toward **light CQRS** (explicit commands vs queries in the application layer) and a **modular monolith** with bounded contexts **Ramp** (Etherfuse) and **Trade bill** (Soroban), without Event Sourcing or a separate read database in the initial phase.

**Ports and repositories:** introduce persistence interfaces (**ports**) and Drizzle implementations (**infrastructure**) in **Phase 5** of the implementation plan, after extracting HTTP handlers into `application/`.

**References:**

- Normative rules: [`docs/ARCHITECTURE-RULES.md`](docs/ARCHITECTURE-RULES.md)  
- Implementation plan (phases / PRs): [`docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md`](docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md)  
- Initial assessment: [`docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md`](docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md)  

---

## 2026-05-19 — v1 platform auth, RBAC roles, and receivable lifecycle

**Decision:** **Login and JWT issuance** live in **Dupply’s backend**. **Human users** authenticate with **JWT**; **server-to-server** callers keep **`X-Dupply-Api-Key`**. User principals include **people** and **service accounts**. **Seller** and **payer** are **always distinct** identities. v1 **roles:** `seller`, `payer`, `admin`, `risk_analyst`, `risk_analyst_agent` (latter reserved for future automation, e.g. n8n). **Receivable** transitions: **create** persists **`under_review` immediately** (no persisted `created` status); **`created_at` + `updated_at`** on the row; `risk_analyst` or `risk_analyst_agent` → `offer` or `repproved`; payer → `confirmed`; **`processing` and `completed` are system-only** (no business user). **No** seller “approved after offer” step in v1 (differs from early sketch).

**References:** [`docs/notes/2026-05-19_platform-auth-rbac-receivable-v1.md`](docs/notes/2026-05-19_platform-auth-rbac-receivable-v1.md)

---

## 2026-05-18 — Repository layout (`src/` + `soroban/`)

**Decision:** A single **Node package at the repo root** (`package.json`, `src/`, `drizzle/`, `scripts/`). Soroban contract in **`soroban/`** with crate at `soroban/crates/duplicata-registry`. The former **indexer** npm package was removed (stub only); **`indexer/README.md`** documents future work.

**Rationale:** avoid a `packages/` folder at the root when there is only one Node app; match the expectation of a repo with `src/`.

**Rollback:** `git revert` and restore paths in documentation.

---

## 2026-05-18 — English language for product code and docs

**Decision:** **Public API, contract identifiers, repository documentation, and user-facing technical prose are in English.** The Soroban contract uses English type and field names (`TradeBillRegistry`, `IssuePayload`, `get_trade_bill`, etc.). HTTP routes live under `/v1/trade-bills` with English JSON field names (see `API.md`). The Rust crate directory name `duplicata-registry` remains for Cargo/wasm artifact stability until a deliberate rename.

**Rationale:** single language for cross-team collaboration, codegen alignment, and Stellar ecosystem conventions.

**Breaking change:** redeploying the Wasm changes the on-chain interface; existing deployed instances need migration or a new contract ID. Regenerate TypeScript bindings from the built Wasm after contract edits.

**References:**

- Soroban contracts: [Stellar — smart contracts](https://developers.stellar.org/docs/build/smart-contracts)  
- Internal note: [`docs/notes/2026-05-18_english-project-language.md`](docs/notes/2026-05-18_english-project-language.md)  
