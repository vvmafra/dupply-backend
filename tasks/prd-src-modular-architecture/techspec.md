# Tech Spec — Source Modular Architecture (Vertical Modules + Shared Infra)

## Overview

This initiative reorganizes `src/` from **horizontal layers** (`domain/`, `application/`, `routes/`, `integrations/`) into **vertical modules** (`src/modules/{context}/`) plus **shared infrastructure** (`src/infra/`). All moves are **behavior-preserving**: same `/v1/*` HTTP contracts, same Drizzle schema semantics, same business rules, same test assertions.

**In scope:** folder moves, import path updates, composition-root refactor, gateway port stubs, Fastify module registration, and governance doc/rule/skill updates (FR-19–FR-28).

**Out of scope:** new product features, second blockchain implementation, Soroban Rust changes, Drizzle schema changes, public URL renames, frontend/SDK work (per PRD).

---

## Architecture overview

Each bounded context becomes a self-contained vertical slice. Layers apply **inside** the module, not at the repo root.

```
src/
├── server.ts                         # bootstrap only — delegates to compose/
├── plugins/                          # global HTTP cross-cutting (JWT, CORS, Swagger)
├── shared/                           # pure cross-module helpers (money)
├── compose/
│   ├── deps.ts                       # AppDeps + gateway ports (composition root)
│   └── registerModules.ts            # wires all registerXxxModule(app, deps)
├── modules/
│   └── {context}/
│       ├── api/                      # Fastify route registration (thin)
│       ├── application/              # commands/, queries/, ports/
│       └── domain/                   # pure rules, types, errors
└── infra/
    ├── env/                          # loadConfig (from config.ts)
    ├── database/                     # Drizzle schema, migrations, db handle
    ├── blockchain/stellar/           # network + Soroban registry adapter
    ├── gateways/
    │   ├── ports/                    # stable interfaces modules depend on
    │   ├── providers/                # Stellar, Etherfuse, BlindPay (stub)
    │   ├── factories/                # select provider from config
    │   └── README.md
    ├── generated/                    # Soroban contract bindings
    └── auth/                         # jwt, refreshToken, authCookie (from lib/)
```

**Layer interaction (unchanged semantics, new paths):**

```
Module api/ (HTTP)
  └── Zod + auth guards + error mapping
Module application/ (use case)
  └── domain rules + infra/gateways/ports + infra/database
Module domain/
  └── pure invariants — no SDK, no DB, no Fastify
infra/gateways/providers/
  └── vendor SDKs (@stellar/stellar-sdk, Etherfuse HTTP, BlindPay stub)
```

**Import matrix (replaces horizontal matrix in ARCHITECTURE-RULES.md):**

| Caller ↓ / Callee → | `modules/*/api` | `modules/*/application` | `modules/*/domain` | `infra/gateways/ports` | `infra/*` (other) | `shared/` | other module's `domain/` |
| ------------------- | --------------- | ------------------------- | -------------------- | ---------------------- | ----------------- | --------- | ------------------------ |
| **Module api** | — | Yes | Yes¹ | Avoid | Avoid² | Yes | **No** |
| **Module application** | **No** | — (same module) | Yes | Yes | Yes | Yes | **No**³ |
| **Module domain** | **No** | **No** | —⁴ | **No** | **No** | Yes | **No** |
| **infra/providers** | **No** | **No** | **No** | Yes (implements) | Yes | Yes | **No** |
| **compose/** | Yes | Yes | Avoid | Yes | Yes | Yes | **No** |

¹ Domain: validation/types only — no I/O.  
² Legacy direct `infra/database` in api allowed only during migration; new code goes through application.  
³ Cross-module: explicit IDs + orchestration in `compose/` or calling module's application via injected port/callback (see FR-5).  
⁴ Intra-module domain imports only.

**Ramp ↔ Registry:** still no cross-imports between `modules/ramp` and `modules/registry` (FR-5, preserved from current rules).

---

## Component design

### 1. Target module map (FR-1, FR-2)

| Module | Current sources | Target `src/modules/{name}/` |
| ------ | --------------- | ---------------------------- |
| **auth** | `routes/v1/auth.ts` | `api/auth.ts` — login, refresh, logout, seller register-on-auth |
| **account** | `routes/v1/accounts.ts`, `domain/account/`, `application/account/` | `api/accounts.ts`, `application/`, `domain/` |
| **seller** | `routes/v1/sellers.ts`, `domain/seller/`, `application/seller/` | full slice |
| **wallet** | `routes/v1/wallets.ts`, `domain/wallet/`, `application/wallet/` | full slice |
| **receivable** | `routes/v1/receivables.ts`, `receivable-internal.ts`, `domain/receivable/`, `application/receivable/` | `api/receivables.ts`, `api/receivable-internal.ts` |
| **payer** | `routes/v1/payers.ts`, `domain/payer/`, `application/payer/` | full slice |
| **registry** | `routes/v1/trade-bills.ts`, `domain/tradeBill/`, `application/tradeBill/` | full slice — **HTTP path stays `/v1/trade-bills`** |
| **ramp** | `routes/v1/ramp.ts`, `webhook-etherfuse.ts`, `application/ramp/` | `api/ramp.ts`, `api/webhook-etherfuse.ts` |
| **settlement** | *(none yet)* | empty placeholder dirs + README (FR-15, OQ-5) |

**Naming (OQ-2):** module folder is `registry`; internal domain folder remains `domain/tradeBill/` for this initiative. Type names (`TradeBill`, `tradeBillDrafts` table refs) unchanged — path-only move minimizes diff noise. Optional follow-up PR can rename domain folder to `registry/` later.

### 2. Infrastructure layout (FR-3, FR-12–FR-15)

| Current path | Target path |
| ------------ | ----------- |
| `src/config.ts` | `src/infra/env/config.ts` — re-export `loadConfig`, `AppConfig` from old path temporarily optional |
| `src/db/**` | `src/infra/database/**` |
| `src/integrations/stellar/network.ts` | `src/infra/blockchain/stellar/network.ts` |
| `src/integrations/registry/**` | `src/infra/blockchain/stellar/registry/**` |
| `src/integrations/etherfuse/**` | `src/infra/gateways/providers/etherfuse/**` |
| *(future BlindPay)* | `src/infra/gateways/providers/blindpay/**` — stub only |
| `src/generated/**` | `src/infra/generated/**` |
| `src/lib/jwt.ts`, `refreshToken.ts`, `authCookie.ts` | `src/infra/auth/**` |

**`drizzle.config.ts`** schema path updates:

```typescript
schema: postgres ? "./src/infra/database/schema.pg.ts" : "./src/infra/database/schema.ts",
```

**Plugins (OQ-4, FR-6):** keep `src/plugins/` at repo root. They are global Fastify cross-cutting (JWT, CORS, Swagger, API key, roles) with no business rules — not vendor infra. Document in ARCHITECTURE-RULES.md; do **not** move to `infra/http/` in this initiative.

**Shared helpers (OQ-1):** keep `src/shared/money.ts` at `src/shared/`. It is a pure, two-function utility with no env/DB coupling; moving it adds churn without boundary benefit. Import matrix allows all layers to use `shared/`.

### 3. Gateway ports, providers, factories (FR-4, FR-11)

Modules depend on **ports** injected via `AppDeps`, never on provider SDKs directly.

**Port: registry (on-chain trade bill)**

```typescript
// src/infra/gateways/ports/registryGateway.ts
import type { IssuePayload } from "../../generated/trade-bill-registry-contract.js";

export type SimulateIssueInput = {
  issuerSecret: string;
  payload: IssuePayload;
};

export type SimulateIssueResult = {
  unsignedXdr: string;
  assembledJson: string;
  simulationLedger: string;
  predictedChainBillId: string;
};

export type ConfirmTxInput = { txHash: string };

export type ConfirmTxResult = {
  chainBillId: string;
  ledger: string;
  tradeBill: Record<string, unknown>;
};

export interface RegistryGateway {
  simulateIssue(input: SimulateIssueInput): Promise<SimulateIssueResult>;
  confirmTx(input: ConfirmTxInput): Promise<ConfirmTxResult>;
  getOnChainBill(chainBillId: string, issuer: string): Promise<Record<string, unknown>>;
}
```

**Port: ramp (Etherfuse FX)**

```typescript
// src/infra/gateways/ports/rampGateway.ts
export type RampQuoteRequest = {
  quoteId: string;
  customerId: string;
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  blockchain: string;
};

export interface RampGateway {
  getAssets(): Promise<unknown[]>;
  createQuote(req: RampQuoteRequest): Promise<unknown>;
  verifyWebhookSignature(payload: Buffer, signature: string): boolean;
}
```

**Port: settlement (PIX — stub until BlindPay POC)**

```typescript
// src/infra/gateways/ports/settlementGateway.ts
export type PixPaymentRequest = {
  amountCents: number;
  payerDocument: string;
  referenceId: string;
};

export interface SettlementGateway {
  /** Returns provider payment id; throws if provider unavailable. */
  initiatePixPayment(req: PixPaymentRequest): Promise<{ providerPaymentId: string }>;
  getPaymentStatus(providerPaymentId: string): Promise<"pending" | "completed" | "failed">;
}
```

**Stellar provider** wraps existing `issue-flow.ts`, `confirm-tx.ts`, `soroban-config.ts`:

```typescript
// src/infra/gateways/providers/stellar/stellarRegistryGateway.ts
import type { RegistryGateway } from "../../ports/registryGateway.js";
import { simulateIssue, createRegistryClient } from "../../../blockchain/stellar/registry/issue-flow.js";
import { parseSuccessfulIssueTx } from "../../../blockchain/stellar/registry/confirm-tx.js";

export function createStellarRegistryGateway(config: AppConfig): RegistryGateway {
  return {
    async simulateIssue(input) { /* delegate to simulateIssue */ },
    async confirmTx(input) { /* delegate to parseSuccessfulIssueTx */ },
    async getOnChainBill(chainBillId, issuer) { /* existing read path */ },
  };
}
```

**Etherfuse provider** wraps `infra/gateways/providers/etherfuse/client.ts` + `webhook-verify.ts`.

**BlindPay stub:**

```typescript
// src/infra/gateways/providers/blindpay/blindPaySettlementGateway.ts
export function createBlindPaySettlementGateway(_config: AppConfig): SettlementGateway {
  return {
    async initiatePixPayment() {
      throw new Error("BlindPay settlement not implemented — see settlement module POC");
    },
    async getPaymentStatus() {
      throw new Error("BlindPay settlement not implemented — see settlement module POC");
    },
  };
}
```

**Factory (FR-11, FR-15):**

```typescript
// src/infra/gateways/factories/createGateways.ts
import type { AppConfig } from "../../env/config.js";
import type { RegistryGateway } from "../ports/registryGateway.js";
import type { RampGateway } from "../ports/rampGateway.js";
import type { SettlementGateway } from "../ports/settlementGateway.js";
import { createStellarRegistryGateway } from "../providers/stellar/stellarRegistryGateway.js";
import { createEtherfuseRampGateway } from "../providers/etherfuse/etherfuseRampGateway.js";
import { createBlindPaySettlementGateway } from "../providers/blindpay/blindPaySettlementGateway.js";

export type Gateways = {
  registry: RegistryGateway;
  ramp: RampGateway;
  settlement: SettlementGateway;
};

export function createGateways(config: AppConfig): Gateways {
  return {
    registry: createStellarRegistryGateway(config),
    ramp: createEtherfuseRampGateway(config),
    settlement: createBlindPaySettlementGateway(config),
  };
}
```

Future second chain: add `infra/blockchain/base/` + `providers/base/` + factory branch — **no** new top-level `domain/` or `application/` trees (FR-15).

### 4. Composition root (FR-4, Technical Constraints)

Move `application/deps.ts` → `src/compose/deps.ts` and extend:

```typescript
// src/compose/deps.ts
import type { AppConfig } from "../infra/env/config.js";
import type { Db } from "../infra/database/index.js";
import type { Gateways } from "../infra/gateways/factories/createGateways.js";
import type { NotifyPayerReceivableConfirmedInput } from "../modules/payer/application/ports/receivableNotification.js";

export type AppDeps = {
  db: Db;
  config: AppConfig;
  gateways: Gateways;
  logger?: { warn?: (obj: Record<string, unknown>, msg: string) => void };
  notifyPayerReceivableConfirmed?: (
    deps: AppDeps,
    input: NotifyPayerReceivableConfirmedInput,
  ) => Promise<void>;
};
```

`server.ts` becomes thin:

```typescript
// After
import { loadConfig } from "./infra/env/config.js";
import { createDb, runMigrations } from "./infra/database/index.js";
import { createGateways } from "./infra/gateways/factories/createGateways.js";
import { registerAllModules } from "./compose/registerModules.js";

const config = loadConfig();
const dbHandle = createDb(config.DATABASE_URL);
await runMigrations(dbHandle);
const gateways = createGateways(config);
const appDeps: AppDeps = { db: dbHandle.db, config, gateways };

await registerAllModules(app, appDeps);
```

**Registry module refactor (behavior-preserving):** `modules/registry/api/trade-bills.ts` must stop importing `@stellar/stellar-sdk` and `integrations/registry/*` directly. Extract orchestration into `modules/registry/application/commands/` that call `deps.gateways.registry`. The route file becomes thin like `modules/wallet/api/wallets.ts` (FR-4, FR-7).

**Ramp module:** `application/ramp/queries/getRampAssets.ts` uses `deps.gateways.ramp` instead of direct Etherfuse client import.

### 5. Fastify module registration (FR-7)

Each module exports one registrar. Pattern mirrors current `registerAuthRoutes(app, deps)`:

```typescript
// src/modules/auth/api/registerAuthModule.ts
import type { FastifyInstance } from "fastify";
import type { AppDeps } from "../../../compose/deps.js";

export async function registerAuthModule(app: FastifyInstance, deps: AppDeps): Promise<void> {
  await app.register(async (scope) => {
    // existing auth routes — same paths, same hooks
  });
}
```

```typescript
// src/compose/registerModules.ts
export async function registerAllModules(app: FastifyInstance, deps: AppDeps): Promise<void> {
  await registerCookie(app);
  await registerCors(app, deps.config);
  await registerSwagger(app, deps.config);

  // Public auth + payer magic link
  await app.register(async (scope) => {
    await registerAuthModule(scope, deps);
    await registerPayerModule(scope, deps);
  });

  // JWT-protected platform routes
  await app.register(async (scope) => {
    scope.addHook("preHandler", requireJwt(deps.config));
    await registerAccountModule(scope, deps);
    await registerSellerModule(scope, deps);
    await registerWalletModule(scope, deps);
    await registerReceivableModule(scope, deps);
  });

  // API-key protected internal + ramp + registry
  await app.register(async (scope) => {
    scope.addHook("preHandler", requireDupplyApiKey(deps.config));
    await registerReceivableInternalModule(scope, deps);
    await registerRampModule(scope, deps);
    await registerRegistryModule(scope, deps);
  });

  await registerRampWebhookModule(app, deps); // top-level, unchanged path
}
```

Auth scope groups and hook order **must match** current `server.ts` lines 61–87 — zero HTTP contract change (FR-7).

### 6. Cross-module communication (FR-5)

**Allowed patterns:**

1. **Explicit IDs** in DB (existing — receivable → seller, wallet → seller, etc.).
2. **Composition-root callbacks** — e.g. `notifyPayerReceivableConfirmed` stays injected on `AppDeps`, implemented in `compose/` wiring receivable → payer application.
3. **Module public surface** — optional `src/modules/{name}/public.ts` exporting stable DTO types or port interfaces other modules may reference (not domain internals).

**Forbidden:** `import { ... } from "../../modules/wallet/domain/types.js"` from receivable application. If receivable needs wallet data, use a query through `AppDeps` injection or DB read in receivable's own application layer.

### 7. Settlement placeholder (OQ-5, FR-14)

Create early in Phase 1 (infra setup):

```
src/modules/settlement/
├── api/.gitkeep
├── application/.gitkeep
├── domain/.gitkeep
└── README.md   # "Reserved for PIX settlement flows; gateway port stub in infra/gateways"
```

No routes registered until BlindPay POC lands. Gateway port + stub provider satisfy FR-11/FR-14 without behavior change.

### 8. Governance updates (FR-19–FR-28)

| Artifact | Action |
| -------- | ------ |
| `docs/ARCHITECTURE-RULES.md` | Rewrite §2 layers for modular layout + import matrix above; update all path examples |
| `AGENTS.md` | Context routing table → `src/modules/{name}/`, `src/infra/` |
| `.cursor/rules/project-context.mdc` | Replace legacy path table |
| `.cursor/rules/architecture-layers.mdc` | Rename content to **modular architecture**; layers apply inside modules |
| `module-*.mdc` (account, wallet, seller, payer, receivables, registry, ramp) | Update `globs` to `src/modules/{name}/**` |
| `routes-swagger.mdc`, `testing.mdc` | Update example paths |
| `.cursor/skills/write-prd/SKILL.md` | Read updated architecture rule; `src/modules/` examples |
| `.cursor/skills/write-techspec/SKILL.md` | Explore `src/modules/{context}/`, `src/infra/` |
| `.cursor/skills/create-tasks/SKILL.md`, `execute-task/SKILL.md` | Reference modular architecture rule |
| `src/infra/gateways/README.md` | Ports vs providers vs factories; how to add chain/vendor (FR-28) |

---

## Data flow

**Example — registry simulate issue (after refactor):**

```
POST /v1/trade-bills/:id/simulate
  → modules/registry/api/trade-bills.ts
      → Zod validate params/body
      → modules/registry/application/commands/simulateTradeBillCommand.ts
          → modules/registry/domain/tradeBill/dto.ts (validateIssueInvariants)
          → infra/database (read/update draft row)
          → deps.gateways.registry.simulateIssue(...)
              → infra/gateways/providers/stellar/stellarRegistryGateway.ts
                  → infra/blockchain/stellar/registry/issue-flow.ts
  → HTTP 200 + same JSON shape as today
```

**Example — human login (unchanged semantics):**

```
POST /v1/auth/login
  → modules/auth/api/auth.ts
      → modules/account/application/commands/loginCommands.ts
          → modules/account/domain/policies.ts
          → infra/database (account lookup)
          → infra/auth/jwt.ts
  → HTTP 200 + tokens/cookies
```

---

## Migration phases (FR-16–FR-18)

Each phase ends with `npm run lint` && `npm test` green (FR-8). One PR per phase recommended; no big-bang (FR-16).

| Phase | Work | Legacy dirs touched | Delete legacy? |
| ----- | ---- | ------------------- | -------------- |
| **0 — Baseline** | Tag/note current green CI | — | No |
| **1 — Infra foundations** | Move `config`, `db`, `generated`, `lib` → `infra/`; create gateway ports/providers/factories/stubs; `compose/deps.ts`; update `drizzle.config.ts`, `server.ts` imports only | partial | No |
| **2 — Pilot: auth + account** | Move auth routes + account slice; `registerAuthModule`, `registerAccountModule`; update tests | `routes/v1/auth.ts`, `routes/v1/accounts.ts`, `application/account/`, `domain/account/` emptied | No |
| **3 — seller + wallet** | Move seller, wallet modules + tests | corresponding legacy folders emptied | No |
| **4 — payer + receivable** | Move payer, receivable (both api files), payer port wiring in compose | corresponding legacy emptied | No |
| **5 — registry** | Move registry module; refactor trade-bills route to use `RegistryGateway`; move stellar/registry code to `infra/blockchain/stellar/` | `integrations/registry`, `integrations/stellar`, `domain/tradeBill`, `application/tradeBill`, `routes/v1/trade-bills.ts` | No |
| **6 — ramp** | Move ramp module + Etherfuse to providers; webhook route; wire `RampGateway` | `integrations/etherfuse`, `application/ramp`, ramp routes | No |
| **7 — settlement placeholder** | Empty module dirs + README | — | No |
| **8 — Legacy cleanup** | Remove empty `src/domain/`, `src/application/`, `src/routes/`, `src/integrations/`, `src/config.ts`, `src/db/`, `src/lib/`, `src/generated/`; shim re-exports if any external script still imports old paths | **delete** (FR-17) | Yes |
| **9 — Governance** | FR-19–FR-28 doc/rule/skill updates | docs, `.cursor/` | No |

**Pilot order (OQ-3):** auth + account together in Phase 2 (not auth + wallet). Auth HTTP handlers delegate to account application commands today; splitting them across phases would leave broken imports. Wallet follows in Phase 3 as validation that the pattern scales.

**Test import updates (FR-18):** mirror module structure under `tests/` — e.g. `tests/modules/account/application/...` — updated in the same PR as each phase's source move. Keep old test paths until phase moves that module (avoid dual paths).

**Rollback:** each phase is revertible via single PR revert; no schema migrations required (FR-9).

---

## Files changed

| File / area | Change type |
| ----------- | ----------- |
| `src/infra/env/config.ts` | Added (move from `config.ts`) |
| `src/infra/database/**` | Added (move from `db/**`) |
| `src/infra/blockchain/stellar/**` | Added (move from `integrations/stellar`, `integrations/registry`) |
| `src/infra/gateways/ports/*.ts` | Added |
| `src/infra/gateways/providers/stellar/*.ts` | Added |
| `src/infra/gateways/providers/etherfuse/**` | Added (move from `integrations/etherfuse`) |
| `src/infra/gateways/providers/blindpay/*.ts` | Added (stub) |
| `src/infra/gateways/factories/createGateways.ts` | Added |
| `src/infra/gateways/README.md` | Added |
| `src/infra/generated/**` | Added (move from `generated/`) |
| `src/infra/auth/**` | Added (move from `lib/`) |
| `src/compose/deps.ts` | Added (move + extend from `application/deps.ts`) |
| `src/compose/registerModules.ts` | Added |
| `src/modules/{auth,account,seller,wallet,receivable,payer,registry,ramp,settlement}/**` | Added (moves) |
| `src/server.ts` | Modified — thin bootstrap |
| `src/plugins/**` | Modified — import path updates only |
| `src/shared/money.ts` | Unchanged location |
| `drizzle.config.ts` | Modified — schema path |
| `scripts/*.ts` | Modified — import paths |
| `tests/**` | Modified — paths per phase |
| `docs/ARCHITECTURE-RULES.md` | Modified — modular rewrite |
| `AGENTS.md` | Modified |
| `.cursor/rules/*.mdc` | Modified |
| `.cursor/skills/*/SKILL.md` | Modified |
| `src/domain/`, `src/application/`, `src/routes/`, `src/integrations/`, `src/config.ts`, `src/db/`, `src/lib/`, `src/generated/` | Deleted (Phase 8 only) |

---

## Impact analysis

- **API compatibility:** Non-breaking. All `/v1/*` paths, methods, auth guards, request/response bodies, and status code semantics unchanged (FR-7).
- **Database:** No migration needed. Table/column names unchanged; only TypeScript import paths to schema files move (FR-9). `drizzle.config.ts` schema path update only.
- **Performance:** No runtime change expected. Gateway factory adds one object allocation at startup — negligible.
- **Other modules:** Scripts (`seed-dev.ts`, etherfuse smoke) need import path updates in Phase 1 or 8. `soroban/` untouched (FR-10).
- **CI:** `npm run lint` (tsc) and `npm test` must pass each phase (FR-8).

---

## Test strategy

### Unit — gateway providers

| Scenario | Input | Expected |
| -------- | ----- | -------- |
| Stellar registry gateway delegates simulate | valid IssuePayload + config | same result shape as direct `simulateIssue` call today |
| Etherfuse ramp gateway getAssets | config with API key | returns asset list (mock HTTP in test) |
| BlindPay stub initiatePix | any | throws "not implemented" |

### Unit — module domain (unchanged assertions)

Existing domain tests move with files — e.g. `domain/account/policies.test.ts` → `tests/modules/account/domain/policies.test.ts`. **No assertion changes.**

### Integration — composition

- `createGateways(config)` returns object implementing all three ports.
- `registerAllModules` registers same route count as current `server.ts` (smoke: fastify.inject `/health`, `/v1/auth/login` validation 400).

### API / E2E

- Run existing route test suites after each phase — primary regression guard:
  - `tests/routes/v1/accountAuthRoutes.test.ts`
  - `tests/routes/v1/walletRoutes.test.ts`
  - `tests/routes/v1/receivables.test.ts`
  - `tests/routes/v1/sellerRoutes.test.ts`
  - *(trade-bills and ramp route tests to add if missing — out of scope unless already present)*

### Per-phase gate

```bash
npm run lint && npm test
```

Must pass before merging each phase PR (FR-8).

---

## Observability

- **Logs:** No new log statements required. Existing Fastify logger in route handlers preserved on move.
- **Errors:** Gateway provider errors map to same HTTP responses as today in registry/ramp routes. BlindPay stub errors surface only if called — no routes call it yet.
- **Startup:** If `createGateways` fails config validation, server fails fast same as current `loadConfig()` behavior.

---

## Functional requirements traceability

| FR | Addressed in |
| -- | ------------ |
| FR-1 | §1 Target module map |
| FR-2 | §1 module subfolders |
| FR-3 | §2 Infrastructure layout |
| FR-4 | §3 Gateway ports, §4 Composition root, registry route refactor |
| FR-5 | §6 Cross-module communication |
| FR-6 | §2 Plugins decision |
| FR-7 | §5 Fastify registration, Impact analysis |
| FR-8 | Migration phases, Test strategy |
| FR-9 | Impact analysis — database |
| FR-10 | Overview out of scope |
| FR-11 | §3 Gateway ports |
| FR-12 | §2 blockchain/stellar path |
| FR-13 | §2 etherfuse provider path |
| FR-14 | §3 BlindPay stub, §7 Settlement placeholder |
| FR-15 | §3 Factory note |
| FR-16 | Migration phases |
| FR-17 | Phase 8 cleanup |
| FR-18 | Migration phases — test imports |
| FR-19–FR-28 | §8 Governance updates |

---

## Open questions resolved

| Question (from PRD) | Decision |
| --------------------- | -------- |
| **OQ-1:** `shared/` placement | Keep `src/shared/` — pure utilities, no I/O; all layers may import. |
| **OQ-2:** `tradeBill` vs `registry` naming | Module folder = `registry`; domain subfolder keeps `tradeBill/` and existing type names; HTTP stays `/v1/trade-bills`. |
| **OQ-3:** Pilot module order | Phase 2 = **auth + account** together; wallet in Phase 3. |
| **OQ-4:** `plugins/` vs `infra/http/` | Keep `src/plugins/` at root — global HTTP cross-cutting, not vendor infra. |
| **OQ-5:** Settlement module timing | Create empty placeholder + gateway stub in Phase 1/7; no routes until BlindPay POC. |
