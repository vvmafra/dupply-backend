# Task 5.0: Refactor `executeLogout` to accept plain refresh token

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Changes `executeLogout` to identify the session via the plain refresh token (SHA-256 lookup key) instead of `accountId`. Logout becomes idempotent: unknown or already-invalidated tokens resolve without throwing. This enables cookie-based logout without requiring a valid access token.

Corresponds to **techspec § Component 7 — Modified `src/application/account/commands/logoutCommands.ts`** and **techspec § Test strategy — Unit `executeLogout`**.

Depends on: _none_

## Requirements

- FR-6: Logout must read session identity from the refresh token (not from JWT `sub`)
- FR-7: Logout must clear refresh token state server-side; silently succeed if token is not found (idempotent)
- Techspec impact: verify with grep that no other module calls `executeLogout` before changing the signature

## Subtasks

- [ ] 5.1 Read `src/application/account/commands/logoutCommands.ts` and `src/lib/refreshToken.ts` (`refreshTokenLookupKey`)
- [ ] 5.2 Grep for `executeLogout` callers and confirm only route layer uses it
- [ ] 5.3 Change `executeLogout(deps, plainRefreshToken: string)` to lookup by `refreshTokenLookup` SHA-256 key
- [ ] 5.4 Update `tests/application/account/commands/authCommands.test.ts` logout test to pass `login.refreshToken` instead of account id
- [ ] 5.5 Add unit test: unknown plain token resolves without throwing
- [ ] 5.6 Verify no TypeScript errors (`npm run lint`)
- [ ] 5.7 Run command tests (`npm test -- tests/application/account/commands/authCommands.test.ts`)

## Implementation details

Reference **techspec § "7. Modified — logoutCommands.ts"**.

```typescript
export async function executeLogout(deps: AppDeps, plainRefreshToken: string): Promise<void> {
  const lookup = refreshTokenLookupKey(plainRefreshToken);
  const [row] = await deps.db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.refreshTokenLookup, lookup))
    .limit(1);

  if (!row) return; // already logged out or token not found — treat as success

  await deps.db
    .update(accounts)
    .set({ refreshToken: null, refreshTokenLookup: null, updatedAt: new Date() })
    .where(eq(accounts.id, row.id));
}
```

Do not require or read JWT claims. Do not throw when token is missing from DB.

Unit test scenarios (from techspec):

| Scenario | Input | Expected |
|----------|-------|----------|
| Token exists in DB | valid plain token from login | clears `refreshToken` and `refreshTokenLookup` on the account |
| Token not found in DB | unknown token string | resolves without throwing |

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test -- tests/application/account/commands/authCommands.test.ts`)
- [ ] `executeLogout` signature is `(deps, plainRefreshToken: string)`
- [ ] Valid token clears DB refresh state; subsequent refresh with same token fails
- [ ] Unknown token call resolves without error
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-refresh-token-cookie/prd.md` ← read first
- `tasks/prd-refresh-token-cookie/techspec.md` ← read first
- `src/application/account/commands/logoutCommands.ts` ← modify
- `src/lib/refreshToken.ts` ← read (uses `refreshTokenLookupKey`)
- `tests/application/account/commands/authCommands.test.ts` ← modify
