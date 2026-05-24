# Task 5.0: Implement account CRUD application layer

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implement the account read, password update, and soft-delete commands/queries in the application layer. These enforce authorization via domain policies and exclude secrets from API-facing views.

Depends on: 1.0, 2.0

## Requirements

- FR-14: `GET` account returns public view (no password hash, no refresh token) to owner or admin
- FR-15: Password update allowed for owner or admin; email change not supported
- FR-16: Soft-delete sets `deletedAt`, clears refresh tokens, admin-only
- FR-17: Standard read queries exclude soft-deleted accounts

## Subtasks

- [x] 5.1 Read existing application command patterns (e.g. receivable commands) for DB access and error handling style
- [x] 5.2 Create `src/application/account/queries/getAccountQuery.ts` with `executeGetAccount`
- [x] 5.3 Create `src/application/account/commands/updatePasswordCommand.ts` with `executeUpdatePassword`
- [x] 5.4 Create `src/application/account/commands/softDeleteAccountCommand.ts` with `executeSoftDeleteAccount`
- [x] 5.5 Write tests covering owner/admin read, forbidden read, password update, admin soft-delete with refresh invalidation
- [x] 5.6 Verify no TypeScript errors (`npm run lint`)

## Implementation details

See techspec **§5 Application — account CRUD**.

`executeGetAccount`:
- `assertCanReadAccount(actor, accountId)`
- SELECT public columns where `id = accountId AND deleted_at IS NULL`
- Throw `account_not_found` if missing
- Map to `AccountPublicView`

`executeUpdatePassword`:
- `assertCanMutateAccount(actor, accountId)`
- Hash new password with Argon2id
- UPDATE where `deleted_at IS NULL`
- Password update does **not** invalidate current refresh token in v1 (document as future hardening)

`executeSoftDeleteAccount`:
- `assertCanSoftDeleteAccount(actor)` — admin only
- SET `deletedAt`, `updatedAt`, `refreshToken = null`, `refreshTokenLookup = null`

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit/integration tests pass (`npm test`)
- [x] Owner GET own account → success, no secrets in response
- [x] Admin GET any account → success
- [x] Non-admin GET other account → `forbidden`
- [x] PATCH password → subsequent login with new password succeeds
- [x] Admin soft-delete → account excluded from reads; login/refresh rejected
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-account-module/prd.md` ← read first
- `tasks/prd-account-module/techspec.md` ← read first
- `src/application/account/queries/getAccountQuery.ts` ← create
- `src/application/account/commands/updatePasswordCommand.ts` ← create
- `src/application/account/commands/softDeleteAccountCommand.ts` ← create
- `src/domain/account/policies.ts` ← use
- `src/domain/account/types.ts` ← use
- `src/db/schema.runtime.ts` ← use
