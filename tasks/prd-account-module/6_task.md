# Task 6.0: Wire HTTP routes and JWT auth plugin

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Expose auth and account endpoints via Fastify routes, update the JWT auth plugin and request types to use `profileId`, and register routes in the server. This is the HTTP edge that delegates all logic to the application layer.

Depends on: 4.0, 5.0

## Requirements

- FR-8: `POST /v1/auth/login` with email/password → token response
- FR-12: `POST /v1/auth/refresh` with refresh token → rotated tokens
- FR-13: `POST /v1/auth/logout` (authenticated) → 204, nullifies refresh
- FR-14: `GET /v1/accounts/:id` → `AccountPublicView` for owner or admin
- FR-15: `PATCH /v1/accounts/:id` with `{ password }` → 204 for owner or admin
- FR-16: `DELETE /v1/accounts/:id` → 204, admin only
- FR-19: Map error codes to HTTP status (401 for invalid credentials/refresh; 403 for inactive/deleted/forbidden)

## Subtasks

- [x] 6.1 Read `src/routes/v1/auth.ts`, `src/plugins/jwt-auth.ts`, and `src/server.ts` for existing route patterns
- [x] 6.2 Update `src/routes/v1/auth.ts`: extend login response, add refresh/logout, remove service-login route and schema
- [x] 6.3 Create `src/routes/v1/accounts.ts` with GET, PATCH, DELETE handlers and Zod schemas at HTTP edge
- [x] 6.4 Update `src/plugins/jwt-auth.ts` and `src/types/fastify.d.ts` — replace `principalKind` with `profileId`
- [x] 6.5 Register account routes in `src/server.ts` behind `requireJwt` hook
- [x] 6.6 Extend `mapAuthError` / account error mapping per techspec HTTP table
- [x] 6.7 Write API/E2E tests: login → refresh → GET account → logout flow; verify JWT has `profileId`
- [x] 6.8 Verify no TypeScript errors (`npm run lint`)

## Implementation details

See techspec **§6 HTTP routes** and error mapping table.

Auth routes:

| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | `/v1/auth/login` | — | `{ accessToken, refreshToken, tokenType, expiresInSeconds, refreshExpiresInSeconds }` |
| POST | `/v1/auth/refresh` | — | same as login |
| POST | `/v1/auth/logout` | Bearer JWT | `204` |

Account routes:

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/v1/accounts/:id` | Bearer JWT | `AccountPublicView` |
| PATCH | `/v1/accounts/:id` | Bearer JWT | `204` |
| DELETE | `/v1/accounts/:id` | Bearer JWT (admin) | `204` |

Error HTTP mapping:
- `invalid_credentials`, `invalid_refresh_token`, `refresh_token_expired` → 401
- `account_inactive`, `account_deleted`, `forbidden` → 403
- `account_not_found` → 404

Update `request.auth` type:
```typescript
auth?: { sub: string; role: AccountRole; profileId: string };
```

Handlers must be ≤ ~50 lines — delegate to application commands.

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Tests pass (`npm test`)
- [x] Full flow works: login → refresh → authenticated GET account → logout
- [x] JWT payload contains `profileId` (mock format), not `principalKind`
- [x] `POST /v1/auth/service-login` route removed
- [x] Error responses use stable `{ error: "<code>" }` JSON shape
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-account-module/prd.md` ← read first
- `tasks/prd-account-module/techspec.md` ← read first
- `src/routes/v1/auth.ts` ← modify
- `src/routes/v1/accounts.ts` ← create
- `src/plugins/jwt-auth.ts` ← modify
- `src/types/fastify.d.ts` ← modify
- `src/server.ts` ← modify
- `src/application/account/commands/` ← use (from tasks 4.0, 5.0)
