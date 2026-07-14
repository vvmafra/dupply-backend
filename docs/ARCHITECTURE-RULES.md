# Architecture rules — `dupply-backend` / HTTP API in `src/`

**Purpose:** engineering contract for evolving the backend with **vertical modules** (bounded contexts), **DDD layers inside each module**, and **light CQRS** (commands vs queries), without unnecessary tooling.  
**Context:** see [`docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md`](notes/2026-05-18_backend-ddd-cqrs-assessment.md).  
**Scope:** code in `src/` (Fastify, Drizzle, gateway providers, Soroban integrations). The Rust contract in `soroban/` follows that crate’s own conventions.

---

## 1. Principles (priority order)

1. **Vertical modules by bounded context:** product code lives under `src/modules/{name}/` with `api/`, `application/`, and `domain/` inside the module — not as top-level horizontal trees.
2. **Shared infrastructure under `infra/`:** env, database, blockchain adapters, and external gateways live under `src/infra/`. Product modules must not import vendor SDKs directly.
3. **Dependencies point inward:** outer layers depend on inner ones; module `domain/` must **not** import Fastify, Drizzle, or gateway providers (pure types only if unavoidable — avoid).
4. **Gateways are an ACL** (*anti-corruption layer*): ports in `infra/gateways/ports/`, providers adapt third-party APIs (Etherfuse HTTP, Soroban RPC, BlindPay) to what the use case needs.
5. **CQRS as discipline:** anything that **mutates state** is a **command**; anything that **only reads** is a **query**. Prefer `commands/` / `queries/` folders inside module `application/`.

---

## 2. Layout (modules + infra)

```
src/
├── server.ts                         # bootstrap only — delegates to compose/
├── plugins/                          # global HTTP cross-cutting (JWT, CORS, Swagger, API key)
├── shared/                           # pure cross-module helpers (e.g. money)
├── compose/
│   ├── deps.ts                       # AppDeps + gateway ports (composition root)
│   └── registerModules.ts            # wires all registerXxxModule(app, deps)
├── modules/
│   └── {context}/
│       ├── api/                      # Fastify route registration (thin)
│       ├── application/              # commands/, queries/, ports/
│       └── domain/                   # pure rules, types, errors
└── infra/
    ├── env/                          # loadConfig
    ├── database/                     # Drizzle schema, migrations, db handle
    ├── blockchain/stellar/           # network + Soroban registry adapter
    ├── gateways/
    │   ├── ports/                    # stable interfaces modules depend on
    │   ├── providers/                # Stellar, Etherfuse, BlindPay (stub)
    │   ├── factories/                # select provider from config
    │   └── README.md
    ├── generated/                    # Soroban contract bindings
    └── auth/                         # jwt, refreshToken, authCookie
```

**Resolved placement decisions:**

| Concern | Placement | Rationale |
| ------- | --------- | --------- |
| `shared/` | `src/shared/` (root) | Pure utilities, no I/O; all layers may import |
| `plugins/` | `src/plugins/` (root) | Global HTTP cross-cutting — not vendor infra; do not nest under `infra/http/` |
| Registry naming | Module = `registry`; domain folder = `tradeBill/` | HTTP stays `/v1/trade-bills`; type names unchanged |

### 2.1 Layers inside a module

| Layer | Path | Responsibility | Rules |
| ----- | ---- | -------------- | ----- |
| **HTTP (api)** | `modules/{ctx}/api/` | Transport, auth, Zod validation, status codes | **Required:** thin routes (~≤50 lines). **Forbidden:** business orchestration, vendor SDKs. |
| **Application** | `modules/{ctx}/application/` | Use cases: orchestrate domain + ports + DB | **Required:** mutating flows go here. One handler per use case. |
| **Domain** | `modules/{ctx}/domain/` | Invariants, ubiquitous language | **Required:** validations that define what is valid. **Forbidden:** SQL, HTTP clients, `process.env`. |
| **Gateways** | `infra/gateways/` | Ports, providers, factories | Modules depend on **ports** via `AppDeps`; providers own SDKs. |
| **Infrastructure** | `infra/database/`, `infra/env/`, `infra/auth/`, `infra/blockchain/` | Config, persistence, auth helpers, chain adapters | **Required:** schema source of truth in `infra/database/schema.ts`. |
| **Generated** | `infra/generated/` | Soroban bindings | **Forbidden:** hand-editing except documented tweaks (regenerate from Wasm). |
| **Compose** | `compose/` | Wire `AppDeps`, register modules | Only place that may assemble cross-module callbacks. |
| **Plugins** | `plugins/` | JWT, CORS, Swagger, API key, roles | No business rules. |

### 2.2 Import matrix

Legend: **Yes** = allowed. **Avoid** = legacy debt or documented exception only; do not expand. **No** = forbidden.

| Caller ↓ / Callee → | `modules/*/api` | `modules/*/application` | `modules/*/domain` | `infra/gateways/ports` | `infra/*` (other) | `shared/` | other module's `domain/` |
| ------------------- | --------------- | ------------------------- | -------------------- | ---------------------- | ----------------- | --------- | ------------------------ |
| **Module api** | — | Yes | Yes¹ | Avoid | Avoid² | Yes | **No** |
| **Module application** | **No** | — (same module) | Yes | Yes | Yes | Yes | **No**³ |
| **Module domain** | **No** | **No** | —⁴ | **No** | **No** | Yes | **No** |
| **infra/providers** | **No** | **No** | **No** | Yes (implements) | Yes | Yes | **No** |
| **compose/** | Yes | Yes | Avoid | Yes | Yes | Yes | **No** |

¹ Domain: validation/types only — no I/O.  
² Legacy direct `infra/database` in api allowed only during migration; new code goes through application.  
³ Cross-module: explicit IDs + orchestration in `compose/` or calling module's application via injected port/callback.  
⁴ Intra-module domain imports only.

**Bounded contexts (Ramp vs Registry):**

| From | To | Rule |
| ---- | -- | ---- |
| `modules/ramp/**`, `infra/gateways/providers/etherfuse/**` | `modules/registry/**`, `infra/blockchain/stellar/registry/**` | **No** cross-imports. Exception: shared infra (`infra/database`, `infra/env`, `shared/`). |
| `modules/registry/**`, stellar registry adapters | `modules/ramp/**`, Etherfuse providers | **No** cross-imports. |

**One-line summary:** only **api** and **application** (plus **compose**) touch the outside world; **domain** is rules and types only; **infra/gateways/providers** own vendor protocols; **infra/database** is persistence.

---

## 3. CQRS

- **Command:** creates or updates persisted data, or calls a mutating external side effect (create quote/order, simulate `issue`, confirm tx, apply webhook). Name in the imperative (`CreateRampOrder`, not `handlePost`).
- **Query:** reads DB or read-only external services only; **no** `insert`/`update`/`delete` or observable side effects (except logs/metrics).
- **Recommended:** separate `commands` vs `queries` under `modules/{ctx}/application/` when adding handlers. Function prefix: **`execute`** + use case name.
- **Allowed:** same physical DB model for reads and writes for now; read models / views only when performance or reporting requires it.

---

## 4. Bounded contexts

| Context | Module path | Infra / external |
| ------- | ----------- | ---------------- |
| **Auth / Account** | `modules/auth/`, `modules/account/` | `infra/auth/`, `infra/database/` |
| **Seller / Wallet** | `modules/seller/`, `modules/wallet/` | Internal DB; Stellar addresses via wallet domain |
| **Payer** | `modules/payer/` | Internal DB; notification port |
| **Receivable** | `modules/receivable/` | Internal DB |
| **Registry** (trade bill) | `modules/registry/` (`domain/tradeBill/`) | `infra/gateways` → Stellar via `RegistryGateway`; `infra/blockchain/stellar/` |
| **Ramp** | `modules/ramp/` | `infra/gateways` → Etherfuse via `RampGateway` |
| **Settlement** (PIX) | `modules/settlement/` (placeholder) | `SettlementGateway` BlindPay stub |

**Cross-context correlation:** only via **explicit IDs** in the DB or composition-root callbacks — no tight coupling between module domains.

---

## 5. Persistence (Drizzle)

- **Required:** schema changes via `src/infra/database/schema.ts` + reviewed/generated migration; do not hand-edit shared DBs only.
- **Recommended:** transactions (`db.transaction`) when a command touches **two or more** rows that must be atomic.
- **Forbidden:** ad hoc SQL in the service except justified, documented cases (e.g. reports).

---

## 6. HTTP API and contracts

- **Required:** input validation with Zod (or equivalent) at the HTTP edge (`modules/*/api/`).
- **Required:** map domain errors to 4xx/5xx in **one place** per context (`mapXxxError` or middleware), not scattered identical `reply.code` branches without need.
- **Recommended:** keep JSON compatibility on documented `/v1/*` routes; breaking changes need `/v2` or an explicit changelog.
- **Forbidden:** expose secrets, full JWTs, or keys in responses/logs.

---

## 7. Configuration and secrets

- **Required:** new variables in `src/infra/env/config.ts` + `.env.example` + mention in `API.md` if operational.
- **Forbidden:** scattered `process.env` outside config (tests excepted).

---

## 8. Tests

- **Recommended:** unit tests for **domain** and **application** without starting HTTP — mirror under `tests/modules/{ctx}/`.
- **Recommended:** gateway providers behind interfaces or fakes in CI; keep manual/script smoke for sandbox.
- **Required:** run `cargo test` on the contract when the trade-bill flow depends on Wasm changes.

---

## 9. Legitimate debt (grandfathering)

Existing fat handlers are grandfathered until touched; when **significantly changing** a handler, **move** toward thin api + application command/query.

### 9.1 Canonical example — platform auth (account module)

Use **`POST /v1/auth/login`**, **`POST /v1/auth/refresh`**, and **`POST /v1/auth/logout`** as the reference split:

| Layer | Files |
| ----- | ----- |
| HTTP | `modules/auth/api/auth.ts`, `modules/account/api/accounts.ts` — Zod, JWT guard, error mappers |
| Application | `modules/account/application/commands/loginCommands.ts` — `executeHumanLogin`, `executeRefreshToken`, `executeLogout`; queries under `application/queries/` |
| Domain | `modules/account/domain/policies.ts`, `modules/account/domain/errors.ts` |
| Infra | `infra/auth/jwt.ts`, `infra/auth/refreshToken.ts`, Drizzle via `infra/database` in application |

New or refactored routes should mirror this layout per bounded context.

---

## 10. Quick PR checklist

- Does the PR name the bounded context (module under `src/modules/`)?
- Are mutations clearly commands and reads clearly queries?
- Did module `domain/` avoid new imports of Fastify/Drizzle/HTTP clients/vendor SDKs?
- Do new external calls go through `infra/gateways/ports`?
- Are `.env.example` / `infra/env/config` updated if config changed?
- Are `README` or `docs/notes` updated if observable behavior changed?

---

## References

- Implementation plan: [`docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md`](notes/2026-05-19_ddd-cqrs-implementation-plan.md)
- DDD+CQRS assessment: [`docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md`](notes/2026-05-18_backend-ddd-cqrs-assessment.md)
- Gateways guide: [`src/infra/gateways/README.md`](../src/infra/gateways/README.md)
- CQRS overview: [martinfowler.com/bliki/CQRS.html](https://martinfowler.com/bliki/CQRS.html)
- CQRS pattern (Microsoft): [learn.microsoft.com/en-us/azure/architecture/patterns/cqrs](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- DDD Reference: [domainlanguage.com/ddd/reference](https://www.domainlanguage.com/ddd/reference/)
