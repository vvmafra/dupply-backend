# Task 6.0: Wire cookie-based auth routes and integration tests

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Updates all four auth route handlers (`login`, `register`, `refresh`, `logout`) to read and write the `dupply_rt` cookie via `authCookie` helpers. Removes `refreshBodySchema`, drops `requireJwt` from logout, and updates route/integration tests to use cookies instead of JSON refresh token fields. This is the final wiring task that completes the HTTP-layer migration.

Corresponds to **techspec § Component 8 — Modified `src/routes/v1/auth.ts`**, **techspec § Data flow**, and **techspec § Test strategy — Integration auth routes**.

Depends on: **1.0**, **2.0**, **3.0**, **4.0**, **5.0**

## Requirements

- FR-1: Login and register set `dupply_rt` cookie on success with correct attributes
- FR-2: Login and register JSON body must not include `refreshToken` or `refreshExpiresInSeconds`
- FR-3: Refresh reads token from `dupply_rt` cookie; rejects missing cookie with `401 { error: "missing_refresh_token" }`
- FR-4: Refresh rotates token on every successful call (new cookie, old token invalidated)
- FR-5: Refresh must NOT accept `refreshToken` in request body — remove body schema entirely
- FR-6: Logout must NOT require valid `Authorization: Bearer` header
- FR-7: Logout clears `dupply_rt` cookie on success regardless of DB token state; always returns `204`
- PRD cleanup: remove `refreshBodySchema`, remove `requireJwt` preHandler from logout, remove `bearerAuth` security from logout schema

## Subtasks

- [ ] 6.1 Read `src/routes/v1/auth.ts` and map all four handlers plus existing schemas
- [ ] 6.2 Update login handler: call `setRefreshCookie`, return `result.body` only
- [ ] 6.3 Update register handler: same cookie pattern, keep `sellerId` in response body
- [ ] 6.4 Update refresh handler: remove body schema, read `request.cookies[REFRESH_COOKIE_NAME]`, rotate cookie, `clearRefreshCookie` on auth errors
- [ ] 6.5 Update logout handler: remove `preHandler: requireJwt`, read cookie, call `executeLogout`, always `clearRefreshCookie`, return `204`
- [ ] 6.6 Update `createTestApp()` in `tests/routes/v1/accountAuthRoutes.test.ts` to register `@fastify/cookie`
- [ ] 6.7 Update all auth route tests to use cookies (parse `Set-Cookie`, pass `Cookie` header on refresh/logout)
- [ ] 6.8 Add integration tests from techspec: missing cookie on refresh, logout without Authorization, invalid cookie clears cookie
- [ ] 6.9 Grep for tests that read `refreshToken` from login JSON body and update helpers (e.g. `walletRoutes.test.ts`, `receivables.test.ts`, `sellerRoutes.test.ts`)
- [ ] 6.10 Verify no TypeScript errors (`npm run lint`)
- [ ] 6.11 Run full test suite (`npm test`)

## Implementation details

Reference **techspec § "8. Modified — src/routes/v1/auth.ts"**, **§ "Data flow"**, and **§ "Test strategy — Integration auth routes"**.

**Login / register:**

```typescript
const result = await executeHumanLogin(deps, request.body);
setRefreshCookie(reply, config, result.refreshToken);
return reply.send(result.body);
```

**Refresh:**

```typescript
const plain = request.cookies[REFRESH_COOKIE_NAME];
if (!plain) {
  return reply.code(401).send({ error: "missing_refresh_token" });
}
try {
  const result = await executeRefreshToken(deps, { refreshToken: plain });
  setRefreshCookie(reply, config, result.refreshToken);
  return reply.send(result.body);
} catch (e) {
  clearRefreshCookie(reply);
  const mapped = mapAuthError(e, reply);
  if (mapped) return mapped;
  throw e;
}
```

**Logout:**

```typescript
const plain = request.cookies[REFRESH_COOKIE_NAME];
if (plain) {
  await executeLogout(deps, plain);
}
clearRefreshCookie(reply);
return reply.code(204).send();
```

Integration test scenarios (from techspec):

| Scenario | Expected |
|----------|----------|
| Login success | `Set-Cookie` with `HttpOnly`, `SameSite=Lax`, `Path=/v1/auth`; body has no `refreshToken` |
| Refresh without cookie | `401 { error: "missing_refresh_token" }` |
| Refresh with valid cookie | new `Set-Cookie`; old token invalidated in DB |
| Refresh with invalid/expired cookie | `401`; `Set-Cookie` clears `dupply_rt` |
| Logout with valid cookie | `204`; cookie cleared; DB row cleared |
| Logout without cookie | `204`; no error |
| Logout without `Authorization` header | `204` |

For `app.inject` cookie testing: parse `set-cookie` from login response headers and pass as `headers: { cookie: "dupply_rt=..." }` on subsequent requests.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Full test suite passes (`npm test`)
- [ ] All four auth handlers use cookie helpers correctly
- [ ] `refreshBodySchema` removed; refresh route has no body schema
- [ ] Logout has no `requireJwt` preHandler or `bearerAuth` security annotation
- [ ] Login/register response bodies contain only `accessToken`, `tokenType`, `expiresInSeconds` (+ `sellerId` on register)
- [ ] End-to-end login → refresh → logout flow works via cookies in route tests
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-refresh-token-cookie/prd.md` ← read first
- `tasks/prd-refresh-token-cookie/techspec.md` ← read first
- `src/routes/v1/auth.ts` ← modify
- `src/lib/authCookie.ts` ← use (created in task 3.0)
- `tests/routes/v1/accountAuthRoutes.test.ts` ← modify
- `tests/routes/v1/walletRoutes.test.ts` ← modify (if login helper reads refreshToken from body)
- `tests/routes/v1/receivables.test.ts` ← modify (if applicable)
- `tests/routes/v1/sellerRoutes.test.ts` ← modify (if applicable)
