# Tech Spec — Account "Me" Route

## Overview

Add **`GET /v1/accounts/me`** as a thin HTTP alias that resolves the target account id from the authenticated JWT `sub` claim and delegates to the existing `executeGetAccount` query. The response body, authorization policy, and error semantics remain identical to `GET /v1/accounts/:id` when `:id` equals `sub`.

**Not in scope:** aggregated session endpoints (`GET /v1/me`), `PATCH`/`DELETE` aliases, `profileId` in the account response, schema/migration changes, auth flow changes, or frontend integration.

Reference: [`tasks/prd-account-me-route/prd.md`](prd.md), [`.cursor/rules/module-account.mdc`](../../.cursor/rules/module-account.mdc).

**FR traceability:** FR-1–FR-7, FR-9 → HTTP route + docs; FR-4 → existing `assertCanReadAccount` (no new logic); FR-8 → no changes to existing handlers; FR-10 → route tests.

---

## Architecture overview

This feature touches only the **HTTP** layer. Application and domain code are reused unchanged.

```
HTTP (routes/v1/accounts.ts)
  └── GET /v1/accounts/me
        → resolve accountId = request.auth.sub
        → executeGetAccount(deps, actor, accountId)

Application (account/queries/getAccountQuery.ts)  — unchanged
  └── assertCanReadAccount(actor, accountId)
  └── SELECT accounts WHERE id = accountId AND deleted_at IS NULL
  └── toPublicView(row) → AccountPublicView

Domain (account/policies.ts, types.ts)  — unchanged
  └── assertCanReadAccount — owner or admin
  └── AccountPublicView — safe response shape
```

The route is registered under the same scoped plugin as existing account routes, which already applies `requireJwt` via `preHandler` in `server.ts` / test harness.

---

## Component design

### 1. Static route — `GET /v1/accounts/me`

**File:** `src/routes/v1/accounts.ts`

Register the new route **before** `GET /v1/accounts/:id` so Fastify matches the literal segment `me` and does not treat it as a dynamic `:id` parameter (FR-7). Fastify resolves routes in registration order for overlapping patterns.

No new Zod params schema is required (no path parameters). Reuse the same auth guard pattern and error mapper as the existing GET handler.

```typescript
// After — register BEFORE the /:id route
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

**Design decisions:**

- **No new application handler** — `executeGetAccount` already accepts `(deps, actor, accountId)`. Passing `request.auth.sub` as `accountId` satisfies FR-2 and FR-3 without duplicating read logic (PRD technical constraint).
- **Authorization via existing policy** — `assertCanReadAccount(actor, actor.sub)` always succeeds for non-admin callers on `/me` because `actor.sub === accountId` (FR-4). Admin callers reading their own account via `/me` behave the same as `GET /:id` with their own id.
- **401 from two layers** — missing/invalid JWT is rejected by `requireJwt` (preHandler) before the handler runs; the handler's `if (!request.auth)` check is defensive and matches the existing `/:id` pattern (FR-5).
- **404 on missing/soft-deleted account** — `executeGetAccount` throws `AccountError(ACCOUNT_ERROR_CODES.NOT_FOUND)` → HTTP 404 with `{ error: "account_not_found" }`, consistent with `GET /:id` (FR-6; see Open questions resolved for PRD wording).
- **Swagger** — same `tags: ["Accounts"]` and `security: [{ bearerAuth: [] }]` as `GET /:id`; no explicit response schema (matches current account routes) (FR-9).

Addresses: **FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-9**.

---

### 2. Existing routes — no behavioral changes

**File:** `src/routes/v1/accounts.ts`

`GET`, `PATCH`, and `DELETE` on `/v1/accounts/:id` remain unchanged (FR-8). No changes to:

- `src/application/account/queries/getAccountQuery.ts`
- `src/domain/account/policies.ts`
- `src/plugins/jwt-auth.ts`
- `src/db/schema.ts`

Addresses: **FR-8**.

---

### 3. Documentation updates

**Files:** `API.md`, `.cursor/rules/module-account.mdc`

Per PRD open questions OQ-1 and OQ-2 (recommended: yes, same PR):

| File | Change |
|------|--------|
| `API.md` | Add `GET /v1/accounts/me` under the Accounts section — authenticated alias for the caller's own account; same response as `GET /v1/accounts/:id` when `:id` = JWT `sub`. |
| `.cursor/rules/module-account.mdc` | Add row to planned routes table: `GET \| /v1/accounts/me \| JWT \| Lê a conta do actor autenticado (alias)`. |

Addresses: **FR-9** (discoverability beyond Swagger).

---

## Data flow

```
GET /v1/accounts/me
  Authorization: Bearer <accessToken>
    → requireJwt (preHandler)
        → verifyAccessToken → request.auth = { sub, role, profileId }
        → 401 { error: "unauthorized" } if missing/invalid/expired
    → route handler
        → actor = { sub: request.auth.sub, role: request.auth.role }
        → executeGetAccount(deps, actor, request.auth.sub)
            → assertCanReadAccount(actor, sub)   // always passes for /me owner
            → SELECT accounts WHERE id = sub AND deleted_at IS NULL
            → 404 { error: "account_not_found" } if no row
            → 200 AccountPublicView
```

Comparison with `GET /v1/accounts/:id`: identical from `executeGetAccount` onward; only the `accountId` source differs (`params.id` vs `auth.sub`).

---

## Files changed

| File | Change type |
|------|-------------|
| `src/routes/v1/accounts.ts` | Modified — add `GET /v1/accounts/me` before `/:id` |
| `tests/routes/v1/accountAuthRoutes.test.ts` | Modified — add `/me` route tests |
| `API.md` | Modified — document new route |
| `.cursor/rules/module-account.mdc` | Modified — add route to planned routes table |

**Not changed:** application, domain, db schema, migrations, auth routes, JWT utilities.

---

## Impact analysis

- **API compatibility:** Non-breaking additive change. Existing clients unaffected. New clients can call `/me` instead of decoding JWT `sub` for session hydration.
- **Database:** No migration. Single-row read by primary key — same as `GET /:id`.
- **Performance:** O(1) lookup by `accounts.id` (indexed PK). No N+1 concerns.
- **Other modules:** None. Frontend teams consume independently; no cross-context imports.
- **Route ordering:** Critical — `/me` must precede `/:id` in `registerAccountRoutes`. If reversed, `me` would be passed to `executeGetAccount` as an invalid id and return 404 (not a security issue, but wrong contract).

---

## Test strategy

Extend `tests/routes/v1/accountAuthRoutes.test.ts` using the existing `createTestApp()` harness (auth + account routes with `requireJwt`).

### Route — `GET /v1/accounts/me`

| Scenario | Input | Expected |
|----------|-------|----------|
| Authenticated owner (FR-10a) | Valid Bearer token for account `id` | `200`; body matches `AccountPublicView`; `id`, `email`, `role`, `status` present; no `passwordHash` or `refreshToken` |
| Unauthenticated (FR-10b) | No `Authorization` header | `401`; `{ error: "unauthorized" }` |
| Response parity (FR-10c) | Same token: `GET /me` vs `GET /:id` where `:id` = JWT `sub` | Status codes equal; JSON bodies deep-equal |
| Soft-deleted account (FR-6) | Token whose `sub` points to soft-deleted account | `404`; `{ error: "account_not_found" }` |
| Invalid/expired token (FR-5) | Malformed or expired Bearer token | `401`; `{ error: "unauthorized" }` |

### Regression — existing `GET /v1/accounts/:id`

| Scenario | Input | Expected |
|----------|-------|----------|
| Non-owner non-admin (unchanged) | Seller token, `GET /:id` for another account | `403`; `{ error: "forbidden" }` |
| Literal `me` not captured by `:id` (FR-7) | `GET /v1/accounts/me` hits `/me` route, not `/:id` with `id=me` | Confirmed by parity test above (returns account view, not 404 for unknown id `me`) |

### Unit / application layer

No new unit tests required — `executeGetAccount` is already covered indirectly by existing route tests. The `/me` route adds no new application code path.

---

## Observability

- **Logs:** None required. Same read path as `GET /:id`; no new failure modes beyond existing account-not-found and unauthorized cases.
- **Error handling:**
  - `401` — `requireJwt` or handler guard → `{ error: "unauthorized" }`
  - `403` — not reachable for normal `/me` callers (owner always matches `sub`); would only occur if handler were miswired
  - `404` — missing or soft-deleted account → `{ error: "account_not_found" }` via `mapAccountError`
  - `503` — `JWT_SECRET` not configured (existing `requireJwt` behavior)

---

## Open questions resolved

| Question (from PRD) | Decision |
|---------------------|----------|
| OQ-1: Update `API.md` in same feature? | **Yes** — include in the same PR as the route. |
| OQ-2: Update `module-account.mdc` planned routes? | **Yes** — add `/me` row to the routes table. |
| FR-6 PRD wording: error code `not_found` | **Use existing `account_not_found`** — matches `GET /v1/accounts/:id` today (`ACCOUNT_ERROR_CODES.NOT_FOUND`). PRD shorthand corrected in implementation; no new error code. |
| D-1: Path choice | **`GET /v1/accounts/me`** — confirmed; no code impact beyond route path. |
| D-2: Response shape | **Reuse `AccountPublicView`** — no new DTO or Zod schema. |
| D-3: Include `profileId`? | **No** — remains JWT-only; out of scope. |
