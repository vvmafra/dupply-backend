# Architecture rules — `dupply-backend` / HTTP API in `src/`

**Purpose:** engineering contract for evolving the backend toward **DDD** (clear domains) and **light CQRS** (commands vs queries), without unnecessary tooling.  
**Context:** see [`docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md`](notes/2026-05-18_backend-ddd-cqrs-assessment.md).  
**Scope:** code in `src/` (Fastify, Drizzle, Etherfuse and Soroban integrations). The Rust contract in `soroban/` follows that crate’s own conventions.

---

## 1. Principles (priority order)

1. **Explicit boundaries** between **Ramp** (Etherfuse) and **Trade bill** (Soroban registry): folders, names, and imports must not mix rules across contexts without a clear use case.
2. **Dependencies point inward:** outer layers depend on inner ones; `domain` must **not** import Fastify, Drizzle, or `integrations` (pure types only if unavoidable — avoid).
3. **Integrations are an ACL** (*anti-corruption layer*): they adapt third-party APIs (Etherfuse HTTP, Soroban RPC) to what the domain / use case needs.
4. **CQRS as discipline:** anything that **mutates state** is a **command**; anything that **only reads** is a **query**. Even before `commands/` / `queries/` folders exist, file and flow names should make that obvious.

---

## 2. Layers and dependencies

| Layer | Responsibility | Rules |
| ----- | -------------- | ----- |
| **HTTP** (`routes/`, `plugins/`, `server.ts`) | Transport, auth, format validation (Zod), status codes | **Required:** **thin** routes — no long orchestration (> ~50 lines per handler). **Forbidden:** business rules beyond error translation or parsing. |
| **Application** (`application/` when present) | Use cases: orchestrate domain + ports + transactions | **Required:** new mutating flows go here. **Recommended:** one handler per use case (`CreateRampQuote`, `ConfirmTradeBillTx`, …). |
| **Domain** (`domain/`) | Invariants, ubiquitous language, aggregates/services | **Required:** validations that define what is valid for Dupply / the contract. **Forbidden:** SQL, HTTP clients, raw `env` (pass resolved values in). |
| **Integrations** (`integrations/`) | External clients, webhook signatures, raw parsing | **Required:** isolate SDKs and URLs. **Forbidden:** knowing details of Dupply’s public HTTP schema (that stays in `routes` + Zod). |
| **Infrastructure** (`db/`, future `infrastructure/persistence/`) | Drizzle, migrations, repository implementations | **Required:** single source of truth in `schema.ts` (+ migrations). **Recommended:** repositories per aggregate/table when the `application` layer exists. |
| **Generated** (`generated/`) | Soroban bindings | **Forbidden:** hand-editing except documented tweaks in README (regenerate from Wasm). |

**Allowed import direction (summary):**

`routes` → `application` → `domain` → *(nothing below)*  
`routes` / `application` → `integrations`, `db` *(until ports exist, direct `db` imports may live in application or routes — migrate when ports are introduced)*  
`domain` → **must not** → `integrations`, `db`, `fastify`

### 2.1 Who may call whom

Legend: **Yes** = allowed. **Avoid** = legacy debt or documented exception only; do not expand. **No** = forbidden by these rules.

**Layer calls layer** matrix (row = caller, column = callee):

| Caller ↓ / Callee → | HTTP | Application | Domain | Integrations | Infrastructure | `generated/` | `config` |
| ------------------- | ---- | ----------- | ------ | ------------- | ---------------- | ------------ | -------- |
| **HTTP** | — | Yes | Yes¹ | Avoid² | Avoid² | Avoid³ | Yes |
| **Application** | **No** | — | Yes | Yes | Yes | Yes⁴ | Yes |
| **Domain** | **No** | **No** | —⁵ | **No** | **No** | Avoid⁶ | **No** |
| **Integrations** | **No** | **No** | **No** | —⁷ | **No** | Yes⁴ | **No**⁸ |
| **Infrastructure** | **No** | **No** | **No** | **No** | — | **No** | **No**⁸ |

¹ **HTTP → Domain:** validation, types, and pure functions only (e.g. Zod + `validateIssueInvariants`). No I/O.  
² **HTTP → Integrations / db:** allowed in legacy code; new flows should go through **Application**.  
³ **HTTP → generated:** avoid; prefer registry / application flow.  
⁴ **Application / Integrations → generated:** Soroban contract bindings; concentrated in registry integration + trade-bill use cases.  
⁵ **Domain → Domain:** imports within the same context (`tradeBill/*`) allowed; keep acyclic.  
⁶ **Domain → generated:** avoid; prefer domain types and map at the edge (`application/tradeBill/mappers/bodyToIssuePayload` or application handlers).  
⁷ **Integrations → Integrations:** only shared helpers in the same area (e.g. `stellar/network` used by `registry`); **do not** import `etherfuse` from `registry` or vice versa.  
⁸ **Integrations / Infrastructure → config:** values injected by the composer (`server` / handler factory); **do not** read `process.env` inside `integrations` or `db`.

**Bounded contexts (Ramp vs trade bill):**

| From | To | Rule |
| ---- | -- | ---- |
| Code under `routes/v1/ramp`, `integrations/etherfuse`, future `domain/ramp` | `domain/tradeBill`, `integrations/registry` | **No** cross-imports. Exception: shared infra (`db`, `config`, generic helpers with no business rules). |
| Code under trade bill (`routes/v1/trade-bills`, `domain/tradeBill`, `integrations/registry`) | `integrations/etherfuse`, future `domain/ramp` | **No** cross-imports. |

**One-line summary:** only **HTTP** and **Application** touch the outside world (HTTP, DB, clients); **Domain** is rules and types only; **Integrations** is external protocols; **Infrastructure** is persistence and migrations.

---

## 3. CQRS

- **Command:** creates or updates persisted data, or calls a mutating external side effect (create quote/order, simulate `issue`, confirm tx, apply webhook). Name in the imperative (`CreateRampOrder`, not `handlePost`).  
- **Query:** reads DB or read-only external services only; **no** `insert`/`update`/`delete` or observable side effects (except logs/metrics).  
- **Recommended:** separate `commands` vs `queries` files/folders when refactoring a module.  
- **Allowed:** same physical DB model for reads and writes for now; read models / views only when performance or reporting requires it.

---

## 4. Bounded contexts

| Context | Typical code today | Rule |
| ------- | ----------------- | ---- |
| **Ramp** | `routes/v1/ramp.ts`, `integrations/etherfuse`, webhook | New ramp rules go in `domain/ramp` (when added) or application handlers, **not** in `domain/tradeBill`. |
| **Trade bill** | `domain/tradeBill`, `integrations/registry`, `routes/v1/trade-bills.ts` | IDs, enums, and hashes stay aligned with the contract; coordinate changes with `soroban/crates/duplicata-registry`. |

**Future ramp ↔ trade bill correlation:** only via **explicit IDs** in the DB or events — no tight temporal coupling in code (no “call ramp when confirming trade bill” without a documented use case).

---

## 5. Persistence (Drizzle)

- **Required:** schema changes via `schema.ts` + reviewed/generated migration; do not hand-edit shared DBs only.  
- **Recommended:** transactions (`db.transaction`) when a command touches **two or more** rows that must be atomic.  
- **Forbidden:** ad hoc SQL in the service except justified, documented cases (e.g. reports).

---

## 6. HTTP API and contracts

- **Required:** input validation with Zod (or equivalent) at the HTTP edge.  
- **Required:** map domain errors to 4xx/5xx in **one place** per context (`mapXxxError` or middleware), not scattered identical `reply.code` branches without need.  
- **Recommended:** keep JSON compatibility on documented `/v1/*` routes; breaking changes need `/v2` or an explicit changelog.  
- **Forbidden:** expose secrets, full JWTs, or keys in responses/logs.

---

## 7. Configuration and secrets

- **Required:** new variables in `config.ts` + `.env.example` + mention in `API.md` if operational.  
- **Forbidden:** scattered `process.env` outside `config` (tests excepted).

---

## 8. Tests

- **Recommended:** unit tests for **domain** and **application** (handlers) without starting HTTP.  
- **Recommended:** Etherfuse/Soroban integrations behind interfaces or fakes in CI; keep manual/script smoke for sandbox.  
- **Required:** run `cargo test` on the contract when the trade-bill flow depends on Wasm changes.

---

## 9. Legitimate debt (grandfathering)

Existing code in `routes/v1/*.ts` with inline Drizzle orchestration **does not** violate these rules until touched; when **significantly changing** a handler, **move** toward the rules (extract command/query or port).

---

## 10. Quick PR checklist

- Does the PR name the bounded context (Ramp / Trade bill / Shared infra)?  
- Are mutations clearly commands and reads clearly queries?  
- Did `domain` avoid new imports of Fastify/Drizzle/HTTP clients?  
- Are `.env.example` / `config` updated if config changed?  
- Are `README` or `docs/notes` updated if observable behavior changed?

---

## References

- Implementation plan: [`docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md`](notes/2026-05-19_ddd-cqrs-implementation-plan.md)  
- DDD+CQRS assessment: [`docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md`](notes/2026-05-18_backend-ddd-cqrs-assessment.md)  
- CQRS overview: [martinfowler.com/bliki/CQRS.html](https://martinfowler.com/bliki/CQRS.html)  
- CQRS pattern (Microsoft): [learn.microsoft.com/en-us/azure/architecture/patterns/cqrs](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)  
- DDD Reference: [domainlanguage.com/ddd/reference](https://www.domainlanguage.com/ddd/reference/)
