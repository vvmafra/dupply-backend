# Task 2.0: Pilot modules — auth + account

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Migrates the first two product modules to the vertical slice layout and introduces Fastify module registration. Auth HTTP handlers move to `modules/auth/api/`; the account domain, application, and routes move to `modules/account/`. Creates `compose/registerModules.ts` with auth scope groups matching current `server.ts` hook order. Makes `server.ts` a thin bootstrap delegating to compose.

Corresponds to **techspec §1 Target module map (auth, account)**, **§5 Fastify module registration**, and **Migration Phase 2**.

Depends on: **1.0**

## Requirements

- FR-1: `auth` and `account` bounded contexts live under `src/modules/{name}/`
- FR-2: Each module contains `api/`, `application/`, and `domain/` subfolders
- FR-7: All existing `/v1/*` auth and account routes remain with same paths, methods, auth guards, and response contracts
- FR-16: Incremental migration — verify auth + account before bulk moves
- FR-18: Update test import paths under `tests/modules/account/` and route tests
- FR-8: `npm run lint` and `npm test` pass at end of phase

## Subtasks

- [x] 2.1 Read `src/routes/v1/auth.ts`, `src/routes/v1/accounts.ts`, `src/domain/account/**`, `src/application/account/**`, and current `src/server.ts` route registration
- [x] 2.2 Create `src/modules/account/domain/`, `application/`, `api/` — move account files preserving behavior
- [x] 2.3 Create `src/modules/auth/api/auth.ts` — move auth route handlers (login, refresh, logout, seller register-on-auth)
- [x] 2.4 Implement `registerAuthModule(app, deps)` and `registerAccountModule(app, deps)`
- [x] 2.5 Create `src/compose/registerModules.ts` with auth scope groups matching current `server.ts` lines 61–87
- [x] 2.6 Refactor `src/server.ts` to thin bootstrap: load config, create db, create gateways, call `registerAllModules`
- [x] 2.7 Move and update tests: `tests/domain/account/**` → `tests/modules/account/domain/**`; update route tests
- [x] 2.8 Verify no TypeScript errors (`npm run lint`) and all tests pass (`npm test`)

## Implementation details

Reference **techspec §5 Fastify module registration** and **§1 Target module map**.

Registration pattern:

```typescript
// src/modules/auth/api/registerAuthModule.ts
export async function registerAuthModule(app: FastifyInstance, deps: AppDeps): Promise<void> {
  await app.register(async (scope) => {
    // existing auth routes — same paths, same hooks
  });
}
```

`registerAllModules` initial version registers auth + account only; later tasks extend it. Auth scope groups and hook order **must match** current `server.ts` — zero HTTP contract change.

Auth handlers delegate to account application commands (existing pattern):

```
POST /v1/auth/login → modules/auth/api/auth.ts → modules/account/application/commands/loginCommands.ts
```

Test path mirror: `tests/modules/account/application/...`, `tests/modules/account/domain/...`.

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] `POST /v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout` behave identically (route tests green)
- [x] Account routes (`/v1/accounts/*`) behave identically
- [x] `server.ts` delegates to `registerAllModules`; no business logic in bootstrap
- [x] Legacy `routes/v1/auth.ts`, `routes/v1/accounts.ts`, `domain/account/`, `application/account/` emptied or removed only if no remaining imports
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-src-modular-architecture/prd.md` ← read first
- `tasks/prd-src-modular-architecture/techspec.md` ← read first
- `src/routes/v1/auth.ts` ← move
- `src/routes/v1/accounts.ts` ← move
- `src/domain/account/**` ← move
- `src/application/account/**` ← move
- `src/modules/auth/**` ← create
- `src/modules/account/**` ← create
- `src/compose/registerModules.ts` ← create
- `src/server.ts` ← modify
- `tests/domain/account/**` ← move
- `tests/routes/v1/accountAuthRoutes.test.ts` ← update imports
