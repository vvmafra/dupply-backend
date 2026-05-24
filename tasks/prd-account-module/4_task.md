# Task 4.0: Implement auth application commands (login, refresh, logout)

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implement the account auth lifecycle in the application layer: human login with access + refresh tokens, refresh with rotation (single-session semantics), and logout that nullifies stored refresh state. Refactor from the existing `application/auth/commands/loginCommands.ts` into `application/account/commands/`.

Depends on: 1.0, 2.0, 3.0

## Requirements

- FR-4: Reject login/refresh for soft-deleted accounts
- FR-5: Reject login/refresh for inactive accounts
- FR-8: Login validates email/password and returns `accessToken`, `refreshToken`, `tokenType`, expiry metadata
- FR-11: Single active session — latest refresh token overwrites previous on login or refresh
- FR-12: Refresh validates stored token, issues new access token, rotates refresh token
- FR-13: Logout nullifies `refresh_token` and `refresh_token_lookup` on the account row

## Subtasks

- [x] 4.1 Read `src/application/auth/commands/loginCommands.ts` for existing login pattern and DB access style
- [x] 4.2 Create `src/application/account/commands/loginCommands.ts` with `executeHumanLogin`
- [x] 4.3 Create `src/application/account/commands/refreshCommands.ts` with `executeRefreshToken`
- [x] 4.4 Create `src/application/account/commands/logoutCommands.ts` with `executeLogout`
- [x] 4.5 Implement DB helpers: `findAccountByEmail` (exclude deleted), `findAccountByRefreshToken` (SHA-256 lookup + Argon2 verify), `persistRefreshToken`
- [x] 4.6 Write integration/unit tests covering happy path, single-session overwrite, rotation, logout invalidation, inactive/deleted/wrong-password failures
- [x] 4.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

See techspec **§4 Application — auth commands** and **Data flow** (Login, Refresh, Logout sections).

`executeHumanLogin` flow:
1. `findAccountByEmail` where `deleted_at IS NULL`
2. `requireLoginCandidate` + `argon2.verify` password
3. `assertCanAuthenticate`
4. `issueRefreshToken` → persist hash + lookup key
5. `signAccessToken` with `mockProfileId`
6. Return `{ accessToken, refreshToken, tokenType: "Bearer", expiresInSeconds, refreshExpiresInSeconds }`

`executeRefreshToken` flow:
1. SHA-256 lookup on `refresh_token_lookup`
2. Parse stored JSON, check TTL against `JWT_REFRESH_TTL_SECONDS`
3. Argon2 verify presented token against stored hash
4. `assertCanAuthenticate`
5. Rotate refresh token (overwrite — FR-11)
6. Issue new access token

`executeLogout`:
- Set `refreshToken = null`, `refreshTokenLookup = null`, update `updatedAt`

Do **not** delete `application/auth/commands/loginCommands.ts` yet — task 7.0 handles legacy removal. New routes will import from `application/account/`.

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit/integration tests pass (`npm test`)
- [x] Login returns both tokens; DB row has populated `refresh_token` and `refresh_token_lookup`
- [x] Second login overwrites previous refresh token (single session)
- [x] Refresh rotates token; old refresh token rejected
- [x] Logout nullifies refresh; subsequent refresh fails
- [x] Inactive account → `account_inactive`; deleted → `account_deleted`; wrong password → `invalid_credentials`
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-account-module/prd.md` ← read first
- `tasks/prd-account-module/techspec.md` ← read first
- `src/application/account/commands/loginCommands.ts` ← create
- `src/application/account/commands/refreshCommands.ts` ← create
- `src/application/account/commands/logoutCommands.ts` ← create
- `src/application/auth/commands/loginCommands.ts` ← reference (delete in task 7.0)
- `src/lib/refreshToken.ts` ← use
- `src/lib/jwt.ts` ← use
- `src/domain/account/policies.ts` ← use
- `src/db/schema.runtime.ts` ← use `accounts` table
