# Task 4.0: Payer + receivable modules

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Migrates payer and receivable bounded contexts to vertical slices. Receivable has two API entry points (`receivables.ts` and `receivable-internal.ts`). Wires the cross-module `notifyPayerReceivableConfirmed` callback through `compose/deps.ts` — composition-root orchestration, not direct cross-module domain imports.

Corresponds to **techspec §1 Target module map (payer, receivable)**, **§6 Cross-module communication**, and **Migration Phase 4**.

Depends on: **3.0**

## Requirements

- FR-1: `payer` and `receivable` bounded contexts under `src/modules/{name}/`
- FR-2: Each module contains `api/`, `application/`, and `domain/` subfolders
- FR-5: Cross-module communication via explicit IDs and composition-root callbacks — no direct imports of another module's `domain/`
- FR-7: All existing receivable and payer routes unchanged, including internal API-key-protected routes
- FR-18: Update test paths under `tests/modules/payer/**` and `tests/modules/receivable/**`
- FR-8: `npm run lint` and `npm test` pass at end of phase

## Subtasks

- [x] 4.1 Read `src/routes/v1/payers.ts`, `src/routes/v1/receivables.ts`, `src/routes/v1/receivable-internal.ts`, payer/receivable domain and application layers, and `notifyPayerReceivableConfirmed` wiring in current deps
- [x] 4.2 Create `src/modules/payer/` — move domain, application (including `ports/receivableNotification.ts`, `ports/magicLinkToken.ts`), and `api/payers.ts`
- [x] 4.3 Create `src/modules/receivable/` — move domain, application, `api/receivables.ts`, and `api/receivable-internal.ts`
- [x] 4.4 Wire `notifyPayerReceivableConfirmed` in `compose/deps.ts` or compose wiring layer (receivable → payer orchestration)
- [x] 4.5 Implement `registerPayerModule`, `registerReceivableModule`, `registerReceivableInternalModule`; update `registerModules.ts` scopes (payer in public scope, receivable in JWT scope, internal in API-key scope)
- [x] 4.6 Move and update tests to `tests/modules/payer/**` and `tests/modules/receivable/**`
- [x] 4.7 Update `tests/routes/v1/receivables.test.ts` import paths
- [x] 4.8 Verify no TypeScript errors (`npm run lint`) and all tests pass (`npm test`)

## Implementation details

Reference **techspec §6 Cross-module communication** and **§5 Fastify module registration**.

Registration scopes (from techspec):

- **Public scope:** `registerPayerModule` (magic link flows)
- **JWT scope:** `registerReceivableModule`
- **API-key scope:** `registerReceivableInternalModule`

Cross-module pattern — composition-root callback on `AppDeps`:

```typescript
notifyPayerReceivableConfirmed?: (
  deps: AppDeps,
  input: NotifyPayerReceivableConfirmedInput,
) => Promise<void>;
```

Forbidden: `import { ... } from "../../modules/wallet/domain/types.js"` from receivable application.

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] Receivable routes (`/v1/receivables/*`) behave identically — route tests green
- [x] Payer magic-link routes behave identically
- [x] Internal receivable routes (API-key protected) behave identically
- [x] `notifyPayerReceivableConfirmed` wired through compose, not cross-module domain imports
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-src-modular-architecture/prd.md` ← read first
- `tasks/prd-src-modular-architecture/techspec.md` ← read first
- `.cursor/rules/module-payer.mdc` ← read for domain conventions
- `.cursor/rules/module-receivables.mdc` ← read for domain conventions
- `src/routes/v1/payers.ts` ← move
- `src/routes/v1/receivables.ts` ← move
- `src/routes/v1/receivable-internal.ts` ← move
- `src/domain/payer/**` ← move
- `src/domain/receivable/**` ← move
- `src/application/payer/**` ← move
- `src/application/receivable/**` ← move
- `src/modules/payer/**` ← create
- `src/modules/receivable/**` ← create
- `src/compose/deps.ts` ← extend callback wiring
- `src/compose/registerModules.ts` ← extend
- `tests/modules/payer/**` ← create/move
- `tests/modules/receivable/**` ← create/move
- `tests/routes/v1/receivables.test.ts` ← update
