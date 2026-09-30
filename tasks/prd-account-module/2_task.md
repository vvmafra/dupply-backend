# Task 2.0: Implement account domain layer (types, errors, policies)

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Create the bounded `domain/account` context with types, error codes, authorization policies, and the mocked `profileId` helper. This replaces the legacy `domain/auth` types (`PlatformUserAuthSnapshot`, `principalKind`) and provides the guard functions used by auth commands and account CRUD.

Depends on: 1.0

## Requirements

- FR-2: Account roles are mutually exclusive (`seller` | `risk_analyst` | `admin`)
- FR-4: Soft-deleted accounts (`deletedAt IS NOT NULL`) cannot authenticate
- FR-5: Inactive accounts cannot authenticate
- FR-6: Domain types expose `passwordHash`, never plain passwords
- FR-14: Authorization policy — account owner or admin can read
- FR-15: Authorization policy — account owner or admin can mutate (password update)
- FR-16: Authorization policy — only admin can soft-delete
- FR-19: Error codes follow existing pattern (`invalid_credentials`, `account_inactive`, etc.)

## Subtasks

- [x] 2.1 Read `src/domain/auth/` (existing patterns) and `docs/ARCHITECTURE-RULES.md` §9.1
- [x] 2.2 Create `src/domain/account/types.ts` with `AccountAuthSnapshot`, `AccountPublicView`, role/status constants
- [x] 2.3 Create `src/domain/account/errors.ts` with `AUTH_ERROR_CODES` and `ACCOUNT_ERROR_CODES`
- [x] 2.4 Create `src/domain/account/policies.ts` with login guards and authorization assertions
- [x] 2.5 Create `src/domain/account/profileId.ts` with `mockProfileId` and `@todo(module-2|3)` comment
- [x] 2.6 Write unit tests in `src/domain/account/policies.test.ts` covering all scenarios from techspec test strategy
- [x] 2.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

See techspec **§2 Domain — account types and policies** and **§3 ProfileId placeholder**.

Policy functions to implement:
- `requireLoginCandidate` → throws `invalid_credentials` if account missing
- `assertCanAuthenticate` → throws `account_deleted` or `account_inactive`
- `assertCanReadAccount` → self or admin passes; others throw `forbidden`
- `assertCanMutateAccount` → delegates to `assertCanReadAccount`
- `assertCanSoftDeleteAccount` → admin only

Error codes (extend beyond existing auth codes):
- `invalid_credentials`, `account_inactive`, `account_deleted`, `invalid_refresh_token`, `refresh_token_expired`
- `account_not_found`, `forbidden`

Do **not** delete `domain/auth/` yet — that happens in task 7.0. New code should import from `domain/account/`.

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] All policy test scenarios from techspec pass (missing candidate, deleted, inactive, self/admin read, forbidden read, non-admin soft-delete)
- [x] `mockProfileId` returns `placeholder-{role}-{accountId}` format
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-account-module/prd.md` ← read first
- `tasks/prd-account-module/techspec.md` ← read first
- `src/domain/account/types.ts` ← create
- `src/domain/account/errors.ts` ← create
- `src/domain/account/policies.ts` ← create
- `src/domain/account/profileId.ts` ← create
- `src/domain/account/policies.test.ts` ← create
- `src/domain/auth/policies.test.ts` ← reference for existing test patterns
