# Task 3.0: Create `authCookie` helpers with unit tests

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Centralises refresh-token cookie configuration in a new `src/lib/authCookie.ts` module. Exports cookie name/path constants plus `setRefreshCookie` and `clearRefreshCookie` helpers so route handlers do not duplicate cookie attribute logic.

Corresponds to **techspec § Component 2 — New file `src/lib/authCookie.ts`** and **techspec § Test strategy — Unit `authCookie.ts`**.

Depends on: **1.0**

## Requirements

- FR-1: Cookie must have `HttpOnly`, `Secure` (production only), `SameSite=Lax`, and `Path=/v1/auth` attributes; TTL must match `JWT_REFRESH_TTL_SECONDS`
- FR-10: In non-production environments, the `Secure` cookie attribute may be omitted; `HttpOnly` and `SameSite` must always be set
- Techspec path override: use `Path=/v1/auth` (not `/v1/auth/refresh`) so logout receives the cookie from the browser

## Subtasks

- [ ] 3.1 Read `src/config.ts` to confirm `JWT_REFRESH_TTL_SECONDS` and `NODE_ENV` are available on `AppConfig`
- [ ] 3.2 Create `src/lib/authCookie.ts` with constants and helper functions
- [ ] 3.3 Create `tests/lib/authCookie.test.ts` with unit tests for production vs development `secure` flag and `maxAge` from config
- [ ] 3.4 Verify no TypeScript errors (`npm run lint`)
- [ ] 3.5 Run unit tests (`npm test -- tests/lib/authCookie.test.ts`)

## Implementation details

Reference **techspec § "2. New file — src/lib/authCookie.ts"** and **§ "Test strategy — Unit authCookie.ts"**.

```typescript
export const REFRESH_COOKIE_NAME = "dupply_rt";
export const REFRESH_COOKIE_PATH = "/v1/auth";

export function setRefreshCookie(
  reply: FastifyReply,
  config: AppConfig,
  plainToken: string,
): void {
  reply.setCookie(REFRESH_COOKIE_NAME, plainToken, {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: config.JWT_REFRESH_TTL_SECONDS,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}
```

Unit test scenarios (from techspec):

| Scenario | Input | Expected |
|----------|-------|----------|
| `setRefreshCookie` in production | `NODE_ENV=production` | `secure: true` in `Set-Cookie` |
| `setRefreshCookie` in development | `NODE_ENV=development` | `secure` absent or `false` in `Set-Cookie` |
| `maxAge` from config | `JWT_REFRESH_TTL_SECONDS=3600` | `Max-Age=3600` in `Set-Cookie` |

Use a minimal Fastify app with `@fastify/cookie` registered in the test harness to inspect `Set-Cookie` headers via `app.inject`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test -- tests/lib/authCookie.test.ts`)
- [ ] `REFRESH_COOKIE_NAME` is `"dupply_rt"` and `REFRESH_COOKIE_PATH` is `"/v1/auth"`
- [ ] `setRefreshCookie` sets `HttpOnly`, `SameSite=Lax`, and correct `Path`/`Max-Age`
- [ ] `secure` is `true` only when `NODE_ENV === "production"`
- [ ] `clearRefreshCookie` clears the cookie with matching path
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-refresh-token-cookie/prd.md` ← read first
- `tasks/prd-refresh-token-cookie/techspec.md` ← read first
- `src/lib/authCookie.ts` ← create
- `tests/lib/authCookie.test.ts` ← create
