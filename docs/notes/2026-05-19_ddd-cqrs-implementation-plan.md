# Implementation plan: transition to DDD + light CQRS (`src/`)

**Date:** 2026-05-19  
**Goal:** a sequence of **small, reversible** deliveries that move code in `src/` toward the rules in [`docs/ARCHITECTURE-RULES.md`](../ARCHITECTURE-RULES.md) and the vision in [`2026-05-18_backend-ddd-cqrs-assessment.md`](2026-05-18_backend-ddd-cqrs-assessment.md), **without** stopping feature work or breaking HTTP `/v1/*` contracts without a new version.

**Operating principle:** one **PR = one use case** (or a minimal cohesive group); regression checked with smoke/manual + checklist below.

---

## 1. Prerequisites (before Phase 1)

| # | Task | Done when |
|---|------|-----------|
| P1 | Read and align the team on `ARCHITECTURE-RULES.md` (the “who calls whom” matrix). | Everyone knows where new code belongs. |
| P2 | Record the decision in root `DECISIONS.md` (one paragraph: “light CQRS + modular monolith; ports when we extract handlers”). | File created or section added. |
| P3 | Document smoke/manual: `npm run etherfuse:smoke`, trade-bill flow (curl or Postman) saved in `docs/notes/` or `API.md`. | Copy-paste checklist for each refactor PR. |

---

## 2. Target folder structure (incremental)

You do not need everything in the first PR; **empty folders + one handler** is enough to set the pattern.

```text
src/
├── application/
│   ├── ramp/
│   │   ├── commands/          # createQuote, createOrder, applyWebhook
│   │   ├── queries/           # getAssets, getOrderById
│   │   └── errors.ts          # optional: application errors + HTTP map
│   ├── tradeBill/
│   │   ├── commands/
│   │   └── queries/
│   └── ports/                 # optional in Phase 5: repository interfaces
├── infrastructure/
│   └── persistence/           # optional in Phase 5: drizzle repos
├── routes/v1/                 # keep Fastify registration; thin handlers
├── domain/
│   ├── tradeBill/             # exists
│   └── ramp/                  # Phase 6 (optional): VOs / policies
├── integrations/              # ACL; no mandatory folder move in Phases 1–4
└── db/                        # schema + migrate; repos may import from here
```

---

## 3. Implementation phases

### Phase 1 — Application skeleton + composition

| Order | Deliverable | Details |
| ----- | ----------- | ------- |
| 1.1 | `application/` folder + `AppContext` or `Deps` type | Object passed to handlers: `{ db, config }` + `EtherfuseClient` factory where appropriate. |
| 1.2 | `registerRampRoutes` **only** delegates | e.g. `createRampQuoteHandler(deps)` from `application/ramp/commands/createRampQuote.ts`. |
| 1.3 | `server.ts` | Still creates `db`, `config`, registers plugins; **must not** grow business logic. |

**Done when:** `ramp.ts` has **at least one** endpoint delegated to `application/ramp/...` (simplest first: `GET /v1/ramp/assets` as a **query**).

**Effort:** M.

---

### Phase 2 — Ramp: extract commands and queries (Etherfuse)

Suggested order (simplest to most coupled):

| # | Use case | Type | Suggested file | Notes |
|---|----------|------|----------------|-------|
| 2.1 | `GET /v1/ramp/assets` | Query | `application/ramp/queries/getRampAssets.ts` | Calls `EtherfuseClient` only; no DB. |
| 2.2 | `GET /v1/ramp/orders/:id` | Query | `application/ramp/queries/getRampOrderById.ts` | Drizzle read. |
| 2.3 | `POST /v1/ramp/quotes` | Command | `application/ramp/commands/createRampQuote.ts` | Etherfuse + insert `ramp_quotes`. |
| 2.4 | `POST /v1/ramp/orders` | Command | `application/ramp/commands/createRampOrder.ts` | Validate quote + Etherfuse + insert `ramp_orders`. |

**Done when:** `routes/v1/ramp.ts` **< ~80 lines** of total logic (only Zod + handler call + `mapRampErrorToReply`); JSON behavior unchanged.

**Tests:** unit handler with mock `db` or SQLite `:memory:` (optional in PRs 2.1–2.2; **recommended** before closing Phase 2).

**Effort:** L (several PRs).

---

### Phase 3 — Etherfuse webhook

| Order | Deliverable | Details |
| ----- | ----------- | ------- |
| 3.1 | `ApplyRampWebhookCommand` (illustrative name) | `application/ramp/commands/applyRampWebhook.ts`: signature check (delegate to `integrations/etherfuse/webhook-verify`) + `ramp_orders` update. |
| 3.2 | Idempotency | If payload has event id, persist/process once (future table/column — only if API guarantees id; else document “best effort”). |

**Done when:** `webhook-etherfuse.ts` is thin; same HTTP status codes as today.

**Effort:** S–M.

---

### Phase 4 — Trade bill: commands and queries

| # | Use case | Type | Suggested file |
|---|----------|------|----------------|
| 4.1 | `POST /v1/trade-bills` | Command | `application/tradeBill/commands/simulateTradeBillIssue.ts` |
| 4.2 | `POST /v1/trade-bills/:id/confirm` | Command | `application/tradeBill/commands/confirmTradeBillTx.ts` |
| 4.3 | `GET /v1/trade-bills/:id` | Query | `application/tradeBill/queries/getTradeBillById.ts` |
| 4.4 | `GET /v1/trade-bills/on-chain/:chainId` | Query | `application/tradeBill/queries/getTradeBillOnChain.ts` |

**Done when:** `routes/v1/trade-bills.ts` only orchestrates HTTP; `domain/tradeBill` stays I/O-free; `integrations/registry` called **only** from application (or continues after moving imports from routes).

**Effort:** L.

---

### Phase 5 — Ports and repositories (infra)

| Order | Deliverable | Details |
| ----- | ----------- | ------- |
| 5.1 | Interfaces in `application/ports/` | `RampQuoteRepository`, `RampOrderRepository`, `TradeBillDraftRepository`, `TradeBillChainRepository` — minimal methods (`save`, `findById`, …). |
| 5.2 | Drizzle implementations | `infrastructure/persistence/*.ts` import `schema.ts` and implement interfaces. |
| 5.3 | Composition in `server.ts` or `compositionRoot.ts` | Instantiate real repos and inject into handlers. |

**Done when:** handlers **do not** import `drizzle-orm` directly; handler tests use **fakes** of the interfaces.

**Effort:** L.

---

### Phase 6 — `ramp` domain (optional)

| Deliverable | When |
| ----------- | ---- |
| `domain/ramp/` with VOs (`MoneyAmount`, `resolveAssetIdentifiers` policy) | When ramp logic duplicates or becomes hard to test without domain types. |

**Done when:** rules that are neither “HTTP format” nor “SQL columns” live in `domain/ramp`.

**Effort:** M (depends on appetite).

---

### Phase 7 — “Stronger” CQRS (optional)

Per [`2026-05-18_backend-ddd-cqrs-assessment.md`](2026-05-18_backend-ddd-cqrs-assessment.md) section 5 Phase D:

- Distinct read DTOs for public `GET`.  
- Webhook queue (BullMQ) only with volume/retry requirements.  
- Read replica / views only with metrics or formal requirement.

**Effort:** variable; **must not** block Phases 1–5.

---

## 4. Global order (summary)

```text
Phase 1 (skeleton + 1 ramp query)
  → Phase 2 (remaining ramp)
  → Phase 3 (webhook)
  → Phase 4 (trade bill)
  → Phase 5 (ports/repos)
  → Phase 6–7 (optional)
```

**Rationale:** ramp concentrates more lines in `ramp.ts` and **does not** share domain with trade bill — low merge-conflict risk; trade bill already has `domain/` and needs care with the Soroban contract.

---

## 5. Per-PR checklist (copy into PR description)

- [ ] `/v1/*` URLs and response bodies unchanged (or documented change + version).  
- [ ] Imports follow [`ARCHITECTURE-RULES.md`](../ARCHITECTURE-RULES.md) section 2.1.  
- [ ] Use case labeled **Command** or **Query** in PR title or body.  
- [ ] Smoke/manual run (list command in description).  
- [ ] No new `process.env` outside `config.ts`.  
- [ ] No cross-imports **ramp ↔ tradeBill** (bounded context rules).

---

## 6. Definition of “transition complete” (architectural MVP)

Minimum aligned with assessment (section 8):

- [ ] `ramp`, `trade-bills`, and `webhook-etherfuse` routes are **thin** (≤ ~50 lines of logic per HTTP handler, delegation + error only).  
- [ ] All flows in the assessment “inventory by bounded context” have a handler in `application/`.  
- [ ] Repositories behind **ports** (Phase 5) for at least ramp **or** full trade bill; ideally both.  
- [ ] `DECISIONS.md` updated.  
- [ ] `API.md` includes a short “layered structure” paragraph pointing to `ARCHITECTURE-RULES.md`.

---

## 7. Risks and mitigation

| Risk | Mitigation |
| ---- | ---------- |
| Giant PR | Split by endpoint/use case; do not mix ramp + trade bill in one PR. |
| Etherfuse sandbox regression | Keep `etherfuse-smoke` green in CI or before manual merge. |
| Duplicate Zod types | One schema per payload; routes `parse` and pass **validated** types to handlers. |

**Rollback:** `git revert` the PR; independent phases make this easy.

---

## 8. Internal references

| Document | Use |
| -------- | --- |
| [`docs/ARCHITECTURE-RULES.md`](../ARCHITECTURE-RULES.md) | Normative rules and dependency matrix. |
| [`2026-05-18_backend-ddd-cqrs-assessment.md`](2026-05-18_backend-ddd-cqrs-assessment.md) | Context, target diagram, command/query inventory. |
| [`2026-05-16_dupply-backend-v1-plan.md`](2026-05-16_dupply-backend-v1-plan.md) | Product v1 vision. |
| [`2026-05-18_v1-duplicata-contract-integration-architecture.md`](2026-05-18_v1-duplicata-contract-integration-architecture.md) | Trade bill flow + contract. |

---

## 9. Official documentation (theory)

- CQRS — https://martinfowler.com/bliki/CQRS.html  
- CQRS pattern (Microsoft) — https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs  
- DDD Reference — https://www.domainlanguage.com/ddd/reference/  

**Effort legend:** S = small (&lt; 1 day), M = medium (1–2 days), L = multiple days / multiple PRs.
