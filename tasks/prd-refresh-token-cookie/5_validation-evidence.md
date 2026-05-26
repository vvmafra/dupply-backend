# Validation evidence — Task 5.0: Refactor `executeLogout` to accept plain refresh token

## Changes made

- `src/application/account/commands/logoutCommands.ts`: Changed signature from `(deps, accountId)` to `(deps, plainRefreshToken)`. Looks up account via `refreshTokenLookupKey` SHA-256 hash. Returns early without error when token is not found (idempotent logout). Clears `refreshToken` and `refreshTokenLookup` on match.
- `tests/application/account/commands/authCommands.test.ts`: Updated existing logout test to pass `login.refreshToken` instead of account id. Added test `executeLogout with unknown token resolves without throwing`.

## Test results

```
npm run lint → ✅ 0 errors
node --import tsx --test tests/application/account/commands/authCommands.test.ts → ✅ 10 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified
- [x] Unit tests pass (`authCommands.test.ts`) — 10/10 passing
- [x] `executeLogout` signature is `(deps, plainRefreshToken: string)` — verified
- [x] Valid token clears DB refresh state; subsequent refresh with same token fails — covered by existing logout test
- [x] Unknown token call resolves without error — new dedicated test
- [x] No pre-existing unit tests broken — all 10 auth command tests pass

## Notes

- Grep confirmed callers: `src/routes/v1/auth.ts` (route layer) and `tests/application/account/commands/authCommands.test.ts`. Route handler still passes `request.auth.sub` until **Task 6.0** wires cookie-based logout; TypeScript accepts both as `string`, so lint passes but runtime behavior is unchanged on the HTTP layer until task 6.
- Used `.select()` instead of `.select({ id: accounts.id })` from the techspec snippet — the narrowed projection triggers SQLite/Pg union type errors with `schema.runtime.js`. Matches the existing pattern in `accountAuthDb.ts`.
