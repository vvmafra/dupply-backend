# Task 3.0: Implement JWT and refresh token utilities with config

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Update the JWT access-token contract to use `profileId` instead of `principalKind`, add refresh-token generation/hashing/serialization utilities, and configure TTL defaults. These shared libs are consumed by auth commands in task 4.0.

Depends on: 2.0

## Requirements

- FR-9: Access tokens expire in 15 minutes; refresh tokens expire in 7 days
- FR-10: JWT payload includes `sub`, `role`, and `profileId` (mocked via `mockProfileId`)
- FR-11: Refresh tokens are opaque, hashed with Argon2, with issued-at tracking for expiry enforcement
- FR-12: Refresh token serialization supports rotation (hash + issuedAtMs stored as JSON in DB column)

## Subtasks

- [x] 3.1 Read `src/lib/jwt.ts` and `src/config.ts` to understand current JWT setup
- [x] 3.2 Update `AccessTokenPayload` to use `profileId` instead of `principalKind`; update `signAccessToken`
- [x] 3.3 Create `src/lib/refreshToken.ts` with issue, serialize, parse, and verify helpers
- [x] 3.4 Add `JWT_ACCESS_TTL_SECONDS` (default 900) and `JWT_REFRESH_TTL_SECONDS` (default 604800) to config
- [x] 3.5 Update `.env.example` with new TTL variables
- [x] 3.6 Write unit tests for `refreshToken.ts` (issue + verify round-trip, expiry check, serialization)
- [x] 3.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

See techspec **§3 JWT and refresh token utilities**.

Refresh token strategy:
- Generate opaque token: `randomBytes(32).toString("base64url")`
- Hash with Argon2id (same as passwords)
- Store `{ hash, issuedAtMs }` as JSON in `accounts.refresh_token` column
- SHA-256 lookup key stored separately in `refresh_token_lookup` (used by auth commands, not this task)

Config defaults:

| Variable | Default |
|----------|---------|
| `JWT_ACCESS_TTL_SECONDS` | `900` |
| `JWT_REFRESH_TTL_SECONDS` | `604800` |

Add a one-line note in `API.md` JWT section about mocked `profileId` (full API doc update deferred to task 7.0, but JWT section note can be added here).

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] `signAccessToken` produces JWT with `sub`, `role`, `profileId` claims (no `principalKind`)
- [x] Refresh token issue + Argon2 verify round-trip works
- [x] Expired refresh token (issuedAtMs beyond TTL) is detectable
- [x] Config defaults match FR-9
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-account-module/prd.md` ← read first
- `tasks/prd-account-module/techspec.md` ← read first
- `src/lib/jwt.ts` ← modify
- `src/lib/refreshToken.ts` ← create
- `src/lib/refreshToken.test.ts` ← create
- `src/config.ts` ← modify
- `.env.example` ← modify
- `src/domain/account/profileId.ts` ← import in jwt usage (from task 2.0)
