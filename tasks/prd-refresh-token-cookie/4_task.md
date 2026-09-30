# Task 4.0: Refactor login command types and `buildLoginResult`

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Splits the existing `LoginResult` type into `LoginResponseBody` (HTTP-safe, no refresh token) and `LoginCommandResult` (includes plain refresh token for the route layer to set as a cookie). Updates `buildLoginResult`, `executeHumanLogin`, and `executeRefreshToken` return shapes. This is a breaking change to the JSON contract — refresh token fields are removed from the response body type.

Corresponds to **techspec § Component 6 — Modified `src/application/account/commands/loginCommands.ts`** and **techspec § Test strategy — Unit `buildLoginResult`**.

Depends on: _none_

## Requirements

- FR-2: Login and register must NOT include `refreshToken` or `refreshExpiresInSeconds` in the JSON response body
- PRD cleanup: Remove `LoginResult.refreshToken` and `LoginResult.refreshExpiresInSeconds` from the type and return value
- Techspec: `LoginCommandResult` exposes `body: LoginResponseBody` and top-level `refreshToken: string` for the HTTP layer

## Subtasks

- [ ] 4.1 Read `src/application/account/commands/loginCommands.ts` and identify all `LoginResult` usages
- [ ] 4.2 Replace `LoginResult` with `LoginResponseBody` and `LoginCommandResult`; update `buildLoginResult` return shape
- [ ] 4.3 Update `executeHumanLogin` and `executeRefreshToken` to return `LoginCommandResult`
- [ ] 4.4 Grep for `LoginResult` imports across the codebase and update any consumers
- [ ] 4.5 Update `tests/application/account/commands/authCommands.test.ts` for the new return shape
- [ ] 4.6 Verify no TypeScript errors (`npm run lint`)
- [ ] 4.7 Run command tests (`npm test -- tests/application/account/commands/authCommands.test.ts`)

## Implementation details

Reference **techspec § "6. Modified — loginCommands.ts"**.

New types:

```typescript
export type LoginResponseBody = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
};

export type LoginCommandResult = {
  body: LoginResponseBody;
  refreshToken: string; // plain — route layer sets as cookie, never sent to client
};
```

`buildLoginResult` returns:

```typescript
return {
  body: {
    accessToken,
    tokenType: "Bearer",
    expiresInSeconds: deps.config.JWT_ACCESS_TTL_SECONDS,
  },
  refreshToken: plainRefreshToken,
};
```

Remove the old `LoginResult` type entirely. Do not change login/refresh orchestration logic (`issueRefreshToken`, `persistRefreshToken`, argon2 verify, etc.).

Test updates in `authCommands.test.ts`:

- Assert `result.body.accessToken`, `result.body.tokenType`, `result.body.expiresInSeconds`
- Assert top-level `result.refreshToken` is present
- Assert `result.body` has no `refreshToken` or `refreshExpiresInSeconds` keys
- Update refresh rotation tests to use `login.refreshToken` (top-level) and `refreshed.body.accessToken`

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test -- tests/application/account/commands/authCommands.test.ts`)
- [ ] `LoginResult` type is removed; `LoginResponseBody` and `LoginCommandResult` exported instead
- [ ] `buildLoginResult` returns `{ body, refreshToken }` with no refresh fields in `body`
- [ ] `executeHumanLogin` and `executeRefreshToken` return `LoginCommandResult`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-refresh-token-cookie/prd.md` ← read first
- `tasks/prd-refresh-token-cookie/techspec.md` ← read first
- `src/application/account/commands/loginCommands.ts` ← modify
- `src/application/account/commands/refreshCommands.ts` ← verify return type (if separate file)
- `tests/application/account/commands/authCommands.test.ts` ← modify
