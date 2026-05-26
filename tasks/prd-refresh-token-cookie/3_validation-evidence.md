# Validation evidence — Task 3.0: Create `authCookie` helpers with unit tests

## Changes made

- `src/lib/authCookie.ts`: created module with `REFRESH_COOKIE_NAME` (`dupply_rt`), `REFRESH_COOKIE_PATH` (`/v1/auth`), `setRefreshCookie` (HttpOnly, SameSite=Lax, conditional Secure, maxAge from `JWT_REFRESH_TTL_SECONDS`), and `clearRefreshCookie` (matching path).
- `tests/lib/authCookie.test.ts`: unit tests using a minimal Fastify app with `@fastify/cookie` and `app.inject` to assert `Set-Cookie` headers for production vs development `Secure`, `Max-Age`, and `clearRefreshCookie` behavior.

## Test results

```
npm run lint → ✅ 0 errors
npm test -- tests/lib/authCookie.test.ts → ✅ 5 passing
npm test → ✅ 230 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified via `tsc -p tsconfig.json`.
- [x] Unit tests pass (`npm test -- tests/lib/authCookie.test.ts`) — 5 tests green.
- [x] `REFRESH_COOKIE_NAME` is `"dupply_rt"` and `REFRESH_COOKIE_PATH` is `"/v1/auth"` — dedicated constant test.
- [x] `setRefreshCookie` sets `HttpOnly`, `SameSite=Lax`, and correct `Path`/`Max-Age` — asserted on `Set-Cookie` header.
- [x] `secure` is `true` only when `NODE_ENV === "production"` — production includes `Secure`; development omits it.
- [x] `clearRefreshCookie` clears the cookie with matching path — `Max-Age=0` / expired `Expires` on `Path=/v1/auth`.
- [x] No pre-existing tests broken — full suite 230 passing (was 225).

## Notes

No deviations from the techspec. `AppConfig` already exposes `JWT_REFRESH_TTL_SECONDS` and `NODE_ENV` from task 1.0 dependency chain; no config changes required.
