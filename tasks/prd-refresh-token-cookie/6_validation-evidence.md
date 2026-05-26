# Validation evidence — Task 6.0: Wire cookie-based auth routes and integration tests

## Changes made

- `src/routes/v1/auth.ts`: wired all four auth handlers to `setRefreshCookie` / `clearRefreshCookie`; login and register return `result.body` only (no `refreshToken` in JSON); refresh reads `dupply_rt` from cookie, rotates on success, clears cookie on auth errors; logout removed `requireJwt` and `bearerAuth`, reads cookie and always returns `204`; removed `refreshBodySchema`.
- `tests/routes/v1/accountAuthRoutes.test.ts`: registered `@fastify/cookie` via `registerCookie`; added cookie parse/header helpers; updated login → refresh → logout flow to use `Set-Cookie` / `Cookie` headers; added integration tests for missing cookie, invalid cookie clearing, logout without cookie, and logout without Authorization.
- `tests/routes/v1/walletRoutes.test.ts`: registered `registerCookie` so login can set cookies in route tests.
- `tests/routes/v1/receivables.test.ts`: registered `registerCookie` so login can set cookies in route tests.
- `tests/routes/v1/sellerRoutes.test.ts`: registered `registerCookie` so login/register can set cookies in route tests.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 235 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — `tsc -p tsconfig.json` exit 0.
- [x] Full test suite passes (`npm test`) — 235/235 tests passing.
- [x] All four auth handlers use cookie helpers correctly — login/register call `setRefreshCookie`; refresh reads cookie and rotates; logout clears cookie.
- [x] `refreshBodySchema` removed; refresh route has no body schema — verified in `auth.ts`.
- [x] Logout has no `requireJwt` preHandler or `bearerAuth` security annotation — verified in `auth.ts`.
- [x] Login/register response bodies contain only `accessToken`, `tokenType`, `expiresInSeconds` (+ `sellerId` on register) — asserted in route tests.
- [x] End-to-end login → refresh → logout flow works via cookies in route tests — main flow test updated and passing.
- [x] No pre-existing tests broken — full suite green including wallet, receivables, and seller route tests.

## Notes

None. Implementation follows techspec § Component 8 and integration test strategy exactly. Cookie path remains `/v1/auth` per techspec conflict resolution (tasks 1–3).
