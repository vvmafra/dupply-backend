# Task 6.0: Ramp module + Etherfuse provider consolidation

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Migrates the ramp bounded context to `src/modules/ramp/` and consolidates Etherfuse client code under `src/infra/gateways/providers/etherfuse/`. Refactors ramp application queries to use `deps.gateways.ramp` instead of direct Etherfuse client imports. Moves webhook route to module api layer.

Corresponds to **techspec §1 Target module map (ramp)**, **§2 Infrastructure layout (etherfuse)**, **§3 Etherfuse provider**, **§4 Ramp module**, and **Migration Phase 6**.

Depends on: **5.0**

## Requirements

- FR-1: `ramp` bounded context under `src/modules/ramp/`
- FR-2: Module contains `api/`, `application/`, and `domain/` subfolders
- FR-4: Ramp application uses `deps.gateways.ramp`, not direct Etherfuse client import
- FR-7: All ramp routes and webhook route unchanged (`/v1/ramp/*`, webhook path)
- FR-13: Etherfuse client consolidated under `infra/gateways/providers/etherfuse/`
- FR-5: No cross-imports between `modules/ramp` and `modules/registry`
- FR-18: Update test paths under `tests/modules/ramp/**`
- FR-8: `npm run lint` and `npm test` pass at end of phase

## Subtasks

- [x] 6.1 Read `src/routes/v1/ramp.ts`, `src/routes/v1/webhook-etherfuse.ts`, `src/application/ramp/**`, `src/integrations/etherfuse/**`
- [x] 6.2 Move `src/integrations/etherfuse/**` → `src/infra/gateways/providers/etherfuse/**` (if not fully moved in Task 1)
- [x] 6.3 Update Etherfuse ramp gateway provider to import from consolidated path
- [x] 6.4 Create `src/modules/ramp/` — move application layer and `api/ramp.ts`, `api/webhook-etherfuse.ts`
- [x] 6.5 Refactor `getRampAssets.ts` and other ramp queries to use `deps.gateways.ramp`
- [x] 6.6 Implement `registerRampModule` (API-key scope) and `registerRampWebhookModule` (top-level, unchanged path)
- [x] 6.7 Move and update tests to `tests/modules/ramp/**`
- [x] 6.8 Verify no TypeScript errors (`npm run lint`) and all tests pass (`npm test`)

## Implementation details

Reference **techspec §3 Etherfuse provider** and **§5 Fastify module registration**.

Registration:

```typescript
// API-key scope
await registerRampModule(scope, deps);

// Top-level — unchanged webhook path
await registerRampWebhookModule(app, deps);
```

Ramp application refactor example:

```typescript
// Before: direct import from integrations/etherfuse/client
// After: deps.gateways.ramp.getAssets()
```

Etherfuse ramp gateway wraps `client.ts` + `webhook-verify.ts` from providers folder.

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] Ramp routes (`/v1/ramp/*`) behave identically
- [x] Webhook route behaves identically (signature verification unchanged)
- [x] No direct Etherfuse client imports in `src/modules/ramp/application/**`
- [x] Etherfuse code lives under `src/infra/gateways/providers/etherfuse/**`
- [x] `integrations/etherfuse/` emptied of logic
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-src-modular-architecture/prd.md` ← read first
- `tasks/prd-src-modular-architecture/techspec.md` ← read first
- `.cursor/rules/module-ramp.mdc` ← read for domain conventions
- `src/routes/v1/ramp.ts` ← move
- `src/routes/v1/webhook-etherfuse.ts` ← move
- `src/application/ramp/**` ← move
- `src/integrations/etherfuse/**` ← move to infra
- `src/infra/gateways/providers/etherfuse/**` ← consolidate
- `src/modules/ramp/**` ← create
- `src/compose/registerModules.ts` ← extend
- `tests/modules/ramp/**` ← create/move
