# Task 1.0: GET /v1/accounts/me route and route tests

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Adds `GET /v1/accounts/me` as a thin HTTP alias that resolves the target account id from the authenticated JWT `sub` claim and delegates to the existing `executeGetAccount` query. Route tests cover happy path, auth errors, response parity with `GET /v1/accounts/:id`, and soft-deleted account handling.

Corresponds to **techspec § Component 1 — Static route GET /v1/accounts/me** and **techspec § Test strategy — Route GET /v1/accounts/me**.

Depends on: _none_

## Requirements

- FR-1: Expose `GET /v1/accounts/me` as an authenticated route (Bearer JWT required)
- FR-2: Resolve target account id from JWT `sub` claim
- FR-3: Return the same `AccountPublicView` as `GET /v1/accounts/:id` when `:id` equals `sub` (no `passwordHash` or `refreshToken`)
- FR-4: Enforce existing owner-or-admin authorization via `assertCanReadAccount` (no new policy logic)
- FR-5: Return `401` when no valid JWT is present or token is invalid/expired
- FR-6: Return `404` with `{ error: "account_not_found" }` when account is missing or soft-deleted
- FR-7: Register `/me` **before** `GET /v1/accounts/:id` so `me` is not captured as a dynamic `:id` parameter
- FR-8: Leave existing `GET`, `PATCH`, and `DELETE` on `/v1/accounts/:id` unchanged
- FR-9: Document route in Swagger with `tags: ["Accounts"]`, summary, and `bearerAuth` security
- FR-10: Automated tests for (a) authenticated owner, (b) unauthenticated `401`, (c) response parity with `GET /:id`

## Subtasks

- [ ] 1.1 Read `src/routes/v1/accounts.ts` to understand the existing `GET /:id` handler pattern
- [ ] 1.2 Read `tests/routes/v1/accountAuthRoutes.test.ts` to understand the `createTestApp()` harness
- [ ] 1.3 Add `GET /v1/accounts/me` route **before** the existing `GET /v1/accounts/:id` registration
- [ ] 1.4 Add route tests: authenticated owner, unauthenticated, response parity, soft-deleted account, invalid/expired token
- [ ] 1.5 Verify no TypeScript errors (`npm run lint`)
- [ ] 1.6 Run route tests (`npm test -- tests/routes/v1/accountAuthRoutes.test.ts`)

## Implementation details

Reference **techspec § "1. Static route — GET /v1/accounts/me"**.

Key constraints:

- **No new application handler** — call `executeGetAccount(deps, actor, request.auth.sub)` directly.
- **Route ordering is critical** — insert the `/me` route before `GET /v1/accounts/:id` in `registerAccountRoutes`.
- **Reuse existing error mapping** — same `mapAccountError` and defensive `if (!request.auth)` guard as `GET /:id`.
- **No new Zod params schema** — `/me` has no path parameters.

Handler pattern (from techspec):

```typescript
api.get(
  "/v1/accounts/me",
  {
    schema: {
      tags: ["Accounts"],
      summary: "Buscar conta autenticada (alias /me)",
      security: [{ bearerAuth: [] }],
    },
  },
  async (request, reply) => {
    if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
    try {
      const actor = {
        sub: request.auth.sub,
        role: request.auth.role as AccountRole,
      };
      return await executeGetAccount(deps, actor, request.auth.sub);
    } catch (e) {
      const mapped = mapAccountError(e, reply);
      if (mapped) return mapped;
      throw e;
    }
  },
);
```

Test scenarios (from techspec § Test strategy):

| Scenario | Input | Expected |
|----------|-------|----------|
| Authenticated owner (FR-10a) | Valid Bearer token | `200`; `AccountPublicView` fields present; no secrets |
| Unauthenticated (FR-10b) | No `Authorization` header | `401`; `{ error: "unauthorized" }` |
| Response parity (FR-10c) | Same token: `GET /me` vs `GET /:id` where `:id` = JWT `sub` | Status codes equal; JSON bodies deep-equal |
| Soft-deleted account (FR-6) | Token whose `sub` points to soft-deleted account | `404`; `{ error: "account_not_found" }` |
| Invalid/expired token (FR-5) | Malformed or expired Bearer token | `401`; `{ error: "unauthorized" }` |

Regression: existing `GET /v1/accounts/:id` forbidden test for non-owner non-admin must still pass unchanged.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Route tests pass (`npm test -- tests/routes/v1/accountAuthRoutes.test.ts`)
- [ ] `GET /v1/accounts/me` returns `200` with `AccountPublicView` for authenticated owner
- [ ] Unauthenticated and invalid-token requests return `401`
- [ ] Response body from `/me` deep-equals response from `GET /:id` with same token
- [ ] Soft-deleted account returns `404` with `{ error: "account_not_found" }`
- [ ] Route is registered before `/:id` (literal `me` not treated as account id)
- [ ] Existing `GET /v1/accounts/:id` behavior unchanged
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-account-me-route/prd.md` ← read first
- `tasks/prd-account-me-route/techspec.md` ← read first
- `src/routes/v1/accounts.ts` ← modify
- `tests/routes/v1/accountAuthRoutes.test.ts` ← modify
