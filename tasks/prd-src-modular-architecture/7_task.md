# Task 7.0: Legacy cleanup

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Removes empty legacy horizontal-layer directories and top-level files after all modules and infra have migrated. Updates import paths in `scripts/*.ts` and any remaining references. Optional temporary shim re-exports only if external scripts still import old paths.

Corresponds to **techspec Migration Phase 8** and **Files changed (deletions)**.

Depends on: **6.0**

## Requirements

- FR-17: Delete legacy paths (`src/domain/`, `src/application/`, `src/routes/`, `src/integrations/`, `src/config.ts`, `src/db/`, `src/lib/`, `src/generated/`) only after all imports and tests no longer reference them
- FR-18: Ensure all test imports point to new module/infra paths — no dual old/new test paths remain
- FR-8: `npm run lint` and `npm test` pass after cleanup
- FR-16: Single revertible PR — no schema changes (FR-9)

## Subtasks

- [x] 7.1 Grep codebase for imports from legacy paths: `src/domain/`, `src/application/`, `src/routes/`, `src/integrations/`, `src/config`, `src/db/`, `src/lib/`, `src/generated/`
- [x] 7.2 Update `scripts/*.ts` import paths (e.g. `seed-dev.ts`, etherfuse smoke scripts)
- [x] 7.3 Update any remaining plugin or type definition imports
- [x] 7.4 Delete empty legacy directories and orphaned top-level files
- [x] 7.5 Add temporary shim re-exports at old paths only if required by external consumers; document and schedule removal
- [x] 7.6 Verify `registerAllModules` registers same route set as pre-migration baseline
- [x] 7.7 Verify no TypeScript errors (`npm run lint`) and all tests pass (`npm test`)

## Implementation details

Reference **techspec Migration Phase 8** and **Files changed** table.

Directories to delete when empty and unreferenced:

- `src/domain/`
- `src/application/`
- `src/routes/`
- `src/integrations/`
- `src/config.ts`
- `src/db/`
- `src/lib/`
- `src/generated/`

Keep at repo root (do not delete):

- `src/plugins/` (FR-6, OQ-4)
- `src/shared/money.ts` (OQ-1)
- `src/server.ts`, `src/compose/`, `src/modules/`, `src/infra/`

Integration smoke check from techspec:

- `createGateways(config)` returns all three ports
- `registerAllModules` registers same route count — smoke via fastify.inject `/health`, `/v1/auth/login` validation 400

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] No imports remain from deleted legacy paths (grep clean)
- [x] Legacy horizontal-layer directories removed
- [x] Script import paths updated
- [x] All existing route test suites pass
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-src-modular-architecture/prd.md` ← read first
- `tasks/prd-src-modular-architecture/techspec.md` ← read first
- `src/domain/` ← delete when empty
- `src/application/` ← delete when empty
- `src/routes/` ← delete when empty
- `src/integrations/` ← delete when empty
- `src/config.ts`, `src/db/`, `src/lib/`, `src/generated/` ← delete
- `scripts/**` ← update imports
- `tests/**` ← verify all paths updated
