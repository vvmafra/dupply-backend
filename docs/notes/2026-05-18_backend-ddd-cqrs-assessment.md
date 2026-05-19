# Dupply backend: DDD + CQRS assessment

**Date:** 2026-05-18  
**Goal:** map the **current** Node app in `src/`, compare with **DDD** (Domain-Driven Design) and **CQRS** (Command Query Responsibility Segregation), and list what to **keep**, **refactor**, or **introduce** — without committing to dates or a “big bang”.  
**Canonical reads:** [Martin Fowler — CQRS](https://martinfowler.com/bliki/CQRS.html), [Azure Architecture Center — CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs), [DDD Reference (Eric Evans / Domain Language)](https://www.domainlanguage.com/ddd/reference/).

---

## 1. What we mean by DDD + CQRS (in this repo)

| Concept | Practical meaning here |
|--------|-------------------------|
| **DDD** | Clear **domain** boundaries (trade bill on Soroban vs Etherfuse ramp), ubiquitous language aligned with contract/API, business rules **outside** HTTP handlers, rich models or domain services where useful, **anti-corruption layer** between “our domain” and SDKs (Stellar, Etherfuse). |
| **CQRS** | Separate **commands** (mutate state: create quote, create order, simulate `issue`, confirm `txHash`, apply webhook) from **queries** (read-only: `GET` ramp order, `GET` trade bill, assets, `get_trade_bill` on-chain). Can start as **module separation**; separate read models only when there is measurable benefit. |

**Not required** in the first iteration: Event Sourcing, distributed message bus, or read models in a separate database — CQRS is a **spectrum** ([Fowler](https://martinfowler.com/bliki/CQRS.html)).

---

## 2. Map of what exists today (`src/`)

```
src/
├── server.ts                 # composition: DB, migrations, route registration
├── config.ts                 # env / AppConfig
├── db/
│   ├── index.ts              # Drizzle + SQLite, migrate on boot
│   └── schema.ts             # tables: ramp_quotes, ramp_orders, trade_bill_drafts, trade_bill_chain_records
├── plugins/
│   └── dupply-auth.ts        # X-Dupply-Api-Key
├── routes/v1/
│   ├── ramp.ts               # GET assets, POST quotes, POST orders, GET order — Zod + EtherfuseClient + Drizzle inline
│   ├── trade-bills.ts        # POST/GET trade bills, confirm — Zod + domain + issue-flow + confirm-tx + Drizzle inline
│   └── webhook-etherfuse.ts  # POST webhook — signature verify + ramp_orders update
├── domain/tradeBill/
│   ├── dto.ts                # Zod schemas + validateIssueInvariants + DomainError
│   └── map-issue-payload.ts  # HTTP body → IssuePayload (contract)
├── integrations/
│   ├── etherfuse/            # HTTP client, webhook-verify
│   ├── registry/             # issue-flow (simulate), confirm-tx
│   └── stellar/              # network passphrase helper
└── generated/                # Soroban bindings (generated from Wasm)
```

### 2.1 Current strengths

- **Integrations** isolated under `integrations/` (Etherfuse, registry, Stellar).  
- **Trade bill:** part of validation and DTO → contract mapping in `domain/tradeBill/`.  
- **Persistence** explicit in Drizzle with a single schema.  
- **Domain errors** typed in several places (`DomainError`, `IssuerNotAllowedError`, etc.) and mapped to HTTP in routes.

### 2.2 Limitations vs DDD + CQRS (structural debt)

| Area | Today | Tension |
|------|-------|---------|
| **Application layer** | Orchestration (validate → call integration → `db.insert/update`) lives in **routes** (`ramp.ts`, `trade-bills.ts`). | Routes grow large; hard to test flow without HTTP; mixes “use case” with serialization. |
| **Ramp** | No `domain/ramp` folder; Zod rules are glued to Fastify. | Second bounded context without a visible domain “core”. |
| **CQRS** | `GET` and `POST` share types/tables and access code; no `CommandHandler` / `QueryHandler` interfaces. | Evolving toward read models or queues has no natural seam. |
| **Repositories** | Drizzle called **directly** in routes. | Domain stays coupled to SQL/Drizzle; swapping DB or testing with doubles requires mocking route modules. |
| **Webhook** | Updates `ramp_orders` inline after verifying signature. | Conceptually an **async command**; could be handler + explicit idempotency (event id). |
| **Bounded contexts** | Ramp and trade bill share `server.ts`, `db`, auth. | OK for a modular monolith; missing only an **explicit boundary** (folders or `application/ramp`, `application/tradeBill`). |

---

## 3. Target vision (high level) — DDD-friendly modular monolith + light CQRS

```text
┌─────────────────────────────────────────────────────────────┐
│  interfaces/http (Fastify) — thin controllers               │
│    → translate HTTP ↔ Command / Query DTOs                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  application (use cases)                                    │
│    commands/   CreateRampQuoteHandler, ConfirmTradeBillTx…  │
│    queries/    GetRampOrderHandler, GetTradeBillHandler…    │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌──────────────────────┐
│ domain/       │  │ domain/        │  │ integrations/       │
│ tradeBill     │  │ ramp (new)     │  │ etherfuse, stellar  │
│ (entities,    │  │ policies,      │  │ registry, …         │
│  services)    │  │  value objects)│  │ (ACL)               │
└───────┬───────┘  └────────┬───────┘  └──────────┬───────────┘
        │                   │                     │
        └───────────────────┼─────────────────────┘
                            ▼
                 ┌─────────────────────┐
                 │ infrastructure/     │
                 │ drizzle repos,      │
                 │ migrations          │
                 └─────────────────────┘
```

- **Commands** return void or a minimal id/result; failures as `Result` or domain exceptions mapped once at HTTP.  
- **Queries** do not mutate state; may use the same Drizzle or later views/read models.

---

## 4. Inventory by bounded context

### 4.1 Ramp (Etherfuse)

| HTTP operation | CQRS type | Today | Suggested refactor |
|----------------|-----------|-------|---------------------|
| `GET /v1/ramp/assets` | Query | Route + `EtherfuseClient` | `GetRampAssetsQuery` + handler; injected client. |
| `POST /v1/ramp/quotes` | Command | Route + client + insert quote | `CreateRampQuoteCommand` + `RampQuoteRepository` + minimal domain (expiry, provider). |
| `POST /v1/ramp/orders` | Command | Route + client + insert order | `CreateRampOrderCommand` + validate existing quote in domain/repo. |
| `GET /v1/ramp/orders/:id` | Query | Route + select | `GetRampOrderByIdQuery`; optional read DTO projection. |
| Etherfuse webhook | Command | `webhook-etherfuse.ts` | `ApplyRampWebhookCommand` + idempotency (`eventId` if present in payload). |

### 4.2 Trade bill (Soroban registry)

| HTTP operation | CQRS type | Today | Suggested refactor |
|----------------|-----------|-------|---------------------|
| `POST /v1/trade-bills` | Command | Route + `validateIssueInvariants` + `simulateIssue` + insert | `SimulateTradeBillIssueCommand` + optional `TradeBillDraft` aggregate or domain service. |
| `POST /v1/trade-bills/:id/confirm` | Command | Route + `parseSuccessfulIssueTx` + inserts | `ConfirmTradeBillTxCommand`. |
| `GET /v1/trade-bills/:id` | Query | Route + logical joins | `GetTradeBillByIdQuery`. |
| `GET /v1/trade-bills/on-chain/:chainId` | Query | Route + read simulation | `GetTradeBillOnChainQuery` (ACL already in registry). |

---

## 5. Refactor backlog (suggested)

### Phase A — “Mechanical” CQRS, no DB change

1. Create `src/application/` with `commands`, `queries` (or per context `ramp/`, `tradeBill/`).  
2. Extract each route flow to **one function/handler** per use case (`executeCreateRampQuote(...)`), with explicit deps (`deps: { rampQuoteRepo, etherfuse }`).  
3. Routes: Zod `parse` → call handler → map error → HTTP status (single `mapDomainErrorToHttp` per context).  
4. Unit tests on handlers with **in-memory repos** or Drizzle `:memory:`.

### Phase B — Repositories (DDD infrastructure)

1. Interfaces `RampQuoteRepository`, `RampOrderRepository`, `TradeBillDraftRepository`, `TradeBillChainRepository` in `domain` or `application/ports`.  
2. Drizzle implementations in `infrastructure/persistence/` (thin wrappers over `schema.ts`).  
3. `domain/tradeBill` gains aggregate types or factories if you want invariants on the object (e.g. no `confirm` without `simulated`).

### Phase C — Ramp domain

1. `domain/ramp/` with value objects (`QuoteAssets`, `MoneyAmount` as string) if you want centralized validation.  
2. `resolveAssetIdentifiers` policy as a domain service calling the Etherfuse ACL.

### Phase D — “Stronger” CQRS (optional, gated)

1. Distinct **read** DTOs from write models (e.g. `RampOrderReadModel` without raw `requestJson` if not needed publicly).  
2. Webhook queue (BullMQ / internal queue) if volume or retries require — aligns with “async command”.  
3. Read replica or materialized view only if latency/complex queries justify it.

---

## 6. What does **not** need to change urgently

- **Drizzle schema** and migrations (rename columns only if ubiquitous language changes).  
- **EtherfuseClient** and **issue-flow** as ACL — may move folder to `infrastructure` but HTTP/Soroban logic can migrate gradually.  
- **Generated** bindings in `generated/`.  
- **Soroban contract** and `IssuePayload` — external source of truth independent of “DDD style”.

---

## 7. Risks and mitigation

| Risk | Mitigation |
|------|------------|
| Large refactor without delivery | Phases A→B; keep routes stable; HTTP contract (smoke) tests after each PR. |
| Over-engineering | Do not introduce aggregates/event store until the team feels pain (routes > ~400 lines or state bugs). |
| DTO duplication | Share Zod between “HTTP input” and “command payload” (one schema, two names). |

### Rollback

Any phase is reversible with `git revert` if handlers are small PRs; keep **same URLs and JSON** for `/v1/*` unless versioning.

---

## 8. “Good enough” criteria for DDD + light CQRS

- [ ] No route with orchestration > ~50 lines (only delegation + HTTP error).  
- [ ] Each state mutation goes through a **named command handler**.  
- [ ] Each relevant `GET` goes through a **query handler**.  
- [ ] Persistence behind **ports** (interfaces) that are testable.  
- [ ] ADR or `DECISIONS.md` update with “light CQRS + modular monolith”.

---

## 9. Recommended next step

1. Approve this document (or adjust vocabulary / phases).  
2. Open an issue or PR for **Phase A** in one bounded context (suggestion: **ramp** first — most logic in the route).  
3. Copy existing smoke (`etherfuse-smoke`, manual `curl`) into a regression checklist.

---

## References

1. CQRS — Martin Fowler — https://martinfowler.com/bliki/CQRS.html  
2. CQRS pattern — Microsoft Azure Architecture — https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs  
3. DDD Reference — Domain Language — https://www.domainlanguage.com/ddd/reference/  
4. Backend v1 plan — `docs/notes/2026-05-16_dupply-backend-v1-plan.md`  
5. Trade bill + contract architecture — `docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md`  
