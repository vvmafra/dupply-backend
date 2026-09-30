# Task 7.0: Remove legacy `platform_users` artifacts and update docs

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Complete the greenfield migration by deleting all remaining `platform_users` code, updating receivable seller validation to use `accounts`, and refreshing documentation to reflect the new auth model. This task ensures no runtime imports of `platformUsers` remain in `src/`.

Depends on: 1.0, 2.0, 4.0, 5.0, 6.0

## Requirements

- FR-18: Remove all `platform_users` schema references, seeds, domain types, service-login, and application queries
- FR-3: Receivable payer validation skips DB lookup (payer entity not yet implemented)
- FR-2: Receivable seller validation checks `accounts` where `role = 'seller'` and `deleted_at IS NULL`

## Subtasks

- [x] 7.1 Grep `src/` for `platformUsers`, `platform_users`, `principalKind`, `PlatformUserAuthSnapshot`, `service-login`, `executeServiceLogin` — fix or delete all references
- [x] 7.2 Delete `src/domain/auth/` (types, errors, policies, tests — replaced by `domain/account/`)
- [x] 7.3 Delete `src/application/auth/commands/loginCommands.ts`
- [x] 7.4 Delete `scripts/seed-platform-dev.ts`
- [x] 7.5 Update `src/application/receivable/commands/receivableCommands.ts` — validate seller via `accounts`; skip payer DB check
- [x] 7.6 Update `API.md`, `README.md`, and `docs/ARCHITECTURE-RULES.md` §9.1 to document account model and new endpoints
- [x] 7.7 Run full test suite and lint; confirm zero `platformUsers` imports in `src/`
- [x] 7.8 Verify no TypeScript errors (`npm run lint`)

## Implementation details

See techspec **§7 Legacy removal** and receivable command impact in **§1 Database schema**.

Artifacts to delete or fully replace:

| Artifact | Action |
|----------|--------|
| `src/domain/auth/*` | Delete entire directory |
| `src/application/auth/commands/loginCommands.ts` | Delete |
| `scripts/seed-platform-dev.ts` | Delete |
| `PlatformUserAuthSnapshot`, `principalKind` | Delete all references |
| `executeServiceLogin`, `requireServiceLoginCandidate` | Delete |
| `POST /v1/auth/service-login` | Already removed in task 6.0 — verify gone |

Receivable command changes:
- Seller: lookup in `accounts` where `role = 'seller'` and `deleted_at IS NULL`
- Payer: accept opaque `payerUserId` string without DB existence check until Module 4/5

Documentation updates:
- `API.md` — auth endpoints (login/refresh/logout), account CRUD, JWT payload with `profileId`, removed service-login
- `README.md` — endpoint list
- `docs/ARCHITECTURE-RULES.md` §9.1 — canonical auth example using `accounts`

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Full test suite passes (`npm test`)
- [x] Zero runtime imports of `platformUsers` in `src/`
- [x] `src/domain/auth/` directory deleted
- [x] `scripts/seed-platform-dev.ts` deleted
- [x] Receivable create validates seller against `accounts`
- [x] Documentation reflects new auth model and breaking API changes
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-account-module/prd.md` ← read first
- `tasks/prd-account-module/techspec.md` ← read first
- `src/domain/auth/` ← delete
- `src/application/auth/commands/loginCommands.ts` ← delete
- `scripts/seed-platform-dev.ts` ← delete
- `src/application/receivable/commands/receivableCommands.ts` ← modify
- `API.md` ← modify
- `README.md` ← modify
- `docs/ARCHITECTURE-RULES.md` ← modify
