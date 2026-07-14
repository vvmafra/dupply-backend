# Task 5.0: Registry module + Stellar blockchain consolidation

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Migrates the registry (trade bill) bounded context to `src/modules/registry/` and consolidates all Stellar/Soroban integration code under `src/infra/blockchain/stellar/`. Refactors `trade-bills.ts` route handlers to stop importing `@stellar/stellar-sdk` and `integrations/registry/*` directly — orchestration moves to application commands calling `deps.gateways.registry`.

Corresponds to **techspec §1 Target module map (registry)**, **§2 Infrastructure layout (blockchain/stellar)**, **§3 Stellar provider**, **§4 Registry module refactor**, and **Migration Phase 5**.

Depends on: **4.0**

## Requirements

- FR-1: `registry` bounded context under `src/modules/registry/` (HTTP path stays `/v1/trade-bills`)
- FR-2: Module contains `api/`, `application/`, and `domain/` — domain subfolder keeps `tradeBill/` naming (OQ-2)
- FR-4: Product modules must not import vendor SDKs; registry routes use `deps.gateways.registry`
- FR-7: All `/v1/trade-bills/*` routes unchanged in paths, methods, auth, and response shapes
- FR-12: Consolidate `src/integrations/registry/**` and `src/integrations/stellar/**` under `infra/blockchain/stellar/`
- FR-15: Blockchain code isolated in infra — future chains add `infra/blockchain/{chain}/` only
- FR-18: Update test paths under `tests/modules/registry/**`
- FR-8: `npm run lint` and `npm test` pass at end of phase

## Subtasks

- [x] 5.1 Read `src/routes/v1/trade-bills.ts`, `src/domain/tradeBill/**`, `src/application/tradeBill/**`, `src/integrations/registry/**`, `src/integrations/stellar/**`
- [x] 5.2 Move `src/integrations/stellar/network.ts` → `src/infra/blockchain/stellar/network.ts`
- [x] 5.3 Move `src/integrations/registry/**` → `src/infra/blockchain/stellar/registry/**`
- [x] 5.4 Update Stellar registry gateway provider to import from new blockchain paths
- [x] 5.5 Create `src/modules/registry/` — move domain (`domain/tradeBill/`), application, and thin `api/trade-bills.ts`
- [x] 5.6 Extract orchestration from route handlers into `modules/registry/application/commands/` (e.g. `simulateTradeBillCommand.ts`) calling `deps.gateways.registry`
- [x] 5.7 Remove direct `@stellar/stellar-sdk` and `integrations/registry/*` imports from module api/application layers
- [x] 5.8 Implement `registerRegistryModule`; add to API-key-protected scope in `registerModules.ts`
- [x] 5.9 Move and update tests; add gateway delegation tests if missing
- [x] 5.10 Verify no TypeScript errors (`npm run lint`) and all tests pass (`npm test`)

## Implementation details

Reference **techspec §4 Registry module refactor** and **Data flow — registry simulate issue**.

Target data flow after refactor:

```
POST /v1/trade-bills/:id/simulate
  → modules/registry/api/trade-bills.ts (Zod + auth + error mapping)
  → modules/registry/application/commands/simulateTradeBillCommand.ts
      → modules/registry/domain/tradeBill/dto.ts
      → infra/database
      → deps.gateways.registry.simulateIssue(...)
          → infra/gateways/providers/stellar/stellarRegistryGateway.ts
              → infra/blockchain/stellar/registry/issue-flow.ts
```

Naming (OQ-2): module folder = `registry`; domain subfolder = `tradeBill/`; type names (`TradeBill`, `tradeBillDrafts`) unchanged; HTTP stays `/v1/trade-bills`.

Ramp ↔ Registry: preserve no cross-imports between `modules/ramp` and `modules/registry` (FR-5).

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] `/v1/trade-bills/*` routes behave identically — same JSON shapes and status codes
- [x] No `@stellar/stellar-sdk` imports in `src/modules/registry/**`
- [x] Stellar/Soroban code lives under `src/infra/blockchain/stellar/**`
- [x] `integrations/registry/` and `integrations/stellar/` emptied of logic
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-src-modular-architecture/prd.md` ← read first
- `tasks/prd-src-modular-architecture/techspec.md` ← read first
- `.cursor/rules/module-registry.mdc` ← read for domain conventions
- `src/routes/v1/trade-bills.ts` ← move + refactor
- `src/domain/tradeBill/**` ← move
- `src/application/tradeBill/**` ← move
- `src/integrations/registry/**` ← move to infra
- `src/integrations/stellar/**` ← move to infra
- `src/infra/blockchain/stellar/**` ← create
- `src/infra/gateways/providers/stellar/**` ← update imports
- `src/modules/registry/**` ← create
- `src/compose/registerModules.ts` ← extend
- `tests/modules/registry/**` ← create/move
