# Validation evidence — Task 4.0: Refactor login command types and `buildLoginResult`

## Changes made

- `src/application/account/commands/loginCommands.ts`: Removed `LoginResult`. Added `LoginResponseBody` (HTTP-safe body without refresh fields) and `LoginCommandResult` (`{ body, refreshToken }`). Updated `buildLoginResult` and `executeHumanLogin` to return `LoginCommandResult`.
- `src/application/account/commands/refreshCommands.ts`: Replaced `LoginResult` import with `LoginCommandResult`; updated `executeRefreshToken` return type.
- `tests/application/account/commands/authCommands.test.ts`: Assertions updated for `result.body.*` (accessToken, tokenType, expiresInSeconds), top-level `result.refreshToken`, and absence of refresh fields in `body`. Refresh rotation tests use `login.refreshToken` (top-level) and `refreshed.body.accessToken`.
- `tests/application/account/accountCrudCommands.test.ts`: Updated `login.accessToken` → `login.body.accessToken` in password-update tests (consumer of new return shape).

## Test results

```
npm run lint → ✅ 0 errors
node --import tsx --test tests/application/account/commands/authCommands.test.ts → ✅ 9 passing
node --import tsx --test tests/application/account/accountCrudCommands.test.ts → ✅ 8 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified
- [x] Unit tests pass (`npm test -- tests/application/account/commands/authCommands.test.ts`) — 9/9 passing
- [x] `LoginResult` type removed; `LoginResponseBody` and `LoginCommandResult` exported instead
- [x] `buildLoginResult` returns `{ body, refreshToken }` with no refresh fields in `body`
- [x] `executeHumanLogin` and `executeRefreshToken` return `LoginCommandResult`
- [x] No pre-existing unit tests broken — `authCommands.test.ts` and `accountCrudCommands.test.ts` pass

## Notes

- HTTP integration tests (`tests/routes/v1/*.test.ts`) fail until **Task 6.0** wires routes to return `result.body` and set cookies. Routes currently return the raw `LoginCommandResult` shape (nested `body` + top-level `refreshToken`), which is expected at this stage.
- `src/routes/v1/auth.ts` was intentionally not modified in this task (scope: application layer only). Task 6 will adapt handlers to `setRefreshCookie(reply, config, result.refreshToken)` and `reply.send(result.body)`.
