# Tech Spec — Refresh Token HttpOnly Cookie

## Overview

This spec covers migrating the refresh token transport from a JSON body field to an `HttpOnly; Secure; SameSite=Lax` cookie named `dupply_rt`. The access token continues to be returned in the response body. Changes touch the HTTP layer (`routes/v1/auth.ts`, `plugins/`), a new infrastructure helper (`lib/authCookie.ts`), and the application layer (`loginCommands.ts`, `logoutCommands.ts`). No schema or migration changes are needed.

**Not in scope (backend PRD):** frontend changes — see frontend auth specs for cookie client integration.

---

## Architecture overview

```
HTTP layer  (routes/v1/auth.ts)
  ├── login/register: call application command → set dupply_rt cookie → return LoginResponseBody
  ├── refresh:        read dupply_rt cookie → call application command → rotate cookie → return LoginResponseBody
  └── logout:         read dupply_rt cookie → call application command → clear cookie → 204

Application layer  (commands/loginCommands.ts, logoutCommands.ts)
  ├── buildLoginResult: returns { body: LoginResponseBody, refreshToken: string } — plain token goes to HTTP layer
  ├── executeHumanLogin / executeRefreshToken: unchanged orchestration, new return shape
  └── executeLogout: receives plain refresh token, looks up by SHA-256 key, clears DB row

Infrastructure  (lib/authCookie.ts — NEW)
  └── cookie name, path, setRefreshCookie(), clearRefreshCookie() helpers
```

---

## Conflict resolution — cookie `Path` vs logout

> PRD decision: `Path=/v1/auth/refresh`, logout reads cookie manually.

This is technically impossible. The `Path` attribute is enforced by the browser: if `Path=/v1/auth/refresh`, the browser will **not** include `dupply_rt` in requests to `/v1/auth/logout`, and since the cookie is `HttpOnly`, the frontend cannot read its value to send it another way.

**Resolution (overrides PRD open question):** use `Path=/v1/auth`. The cookie is still well-scoped (only sent to `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, and `POST /v1/auth/register`). This is the minimal-viable scope that allows server-side token invalidation on logout.

---

## Component design

### 1. New dependency — `@fastify/cookie`

**Action:** add to `package.json` dependencies.

```bash
npm install @fastify/cookie
```

No configuration (secret signing) needed — the cookie value is a random `base64url` token that is already hashed server-side.

---

### 2. New file — `src/lib/authCookie.ts`

Centralises all cookie concerns so they do not leak into route handlers.

```typescript
import type { FastifyReply } from "fastify";
import type { AppConfig } from "../config.js";

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

> **FR-1, FR-10 covered here.** `secure` is conditional on `NODE_ENV === "production"` to support HTTP in local dev.

---

### 3. New file — `src/plugins/cookie.ts`

```typescript
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

export async function registerCookie(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
}
```

> **FR-8 covered here.**

---

### 4. Modified — `src/server.ts`

Register the cookie plugin immediately after Fastify is created, before any route plugin:

```typescript
// after app.setSerializerCompiler(...)
await registerCookie(app);
await registerCors(app, config);
```

Import to add:
```typescript
import { registerCookie } from "./plugins/cookie.js";
```

---

### 5. Modified — `src/plugins/cors.ts`

Add `credentials: true` to the `cors` registration options. Wildcard origin is already forbidden (existing origin-allowlist logic is unchanged).

```typescript
// Before
await app.register(cors, {
  origin: (origin, callback) => { ... },
  methods: [...],
  allowedHeaders: [...],
});

// After
await app.register(cors, {
  origin: (origin, callback) => { ... },
  credentials: true,           // ← new
  methods: [...],
  allowedHeaders: [...],
});
```

> **FR-9 covered here.** `credentials: true` is safe because the origin check is already restrictive.

---

### 6. Modified — `src/application/account/commands/loginCommands.ts`

**Two changes:**

#### 6a. Split `LoginResult` into internal + HTTP-body types

```typescript
// New: body shape returned to the HTTP client (no refresh token)
export type LoginResponseBody = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
};

// New: what the application layer returns (includes plain token for the route to cookie-ify)
export type LoginCommandResult = {
  body: LoginResponseBody;
  refreshToken: string; // plain — route layer sets this as a cookie, never sent to client
};

// Remove the old LoginResult type entirely.
```

#### 6b. Update `buildLoginResult` return shape

```typescript
export async function buildLoginResult(
  deps: AppDeps,
  account: AccountAuthSnapshot,
  plainRefreshToken: string,
): Promise<LoginCommandResult> {
  const profileId = await resolveProfileId(deps, account.id, account.role);
  const accessToken = await signAccessToken(deps.config, {
    sub: account.id,
    role: account.role,
    profileId,
  });

  return {
    body: {
      accessToken,
      tokenType: "Bearer",
      expiresInSeconds: deps.config.JWT_ACCESS_TTL_SECONDS,
    },
    refreshToken: plainRefreshToken,
  };
}
```

`executeHumanLogin` and `executeRefreshToken` return `LoginCommandResult` unchanged (they delegate to `buildLoginResult`).

> **FR-2 covered here.** `refreshToken` and `refreshExpiresInSeconds` are gone from the response body type.

---

### 7. Modified — `src/application/account/commands/logoutCommands.ts`

Change `executeLogout` to accept the plain refresh token instead of `accountId`. Identify the account via the SHA-256 lookup key (fast, no argon2). Silently succeed if not found (idempotent).

```typescript
import { eq } from "drizzle-orm";
import type { AppDeps } from "../../deps.js";
import { accounts } from "../../../db/schema.runtime.js";
import { refreshTokenLookupKey } from "../../../lib/refreshToken.js";

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

> **FR-6, FR-7 covered here.** No access token required; silently succeeds even if token is already invalidated.

---

### 8. Modified — `src/routes/v1/auth.ts`

Four handlers change. Cookie helper and new types imported.

#### 8a. Login handler

```typescript
// Before: return await executeHumanLogin(deps, request.body);

// After:
const result = await executeHumanLogin(deps, request.body);
setRefreshCookie(reply, config, result.refreshToken);
return reply.send(result.body);
```

Remove `loginBodySchema` change — body schema is unchanged. Remove `refreshBodySchema` entirely (refresh no longer has a body).

> **FR-1, FR-2 covered here.**

#### 8b. Register handler

Same pattern as login:

```typescript
const result = await buildLoginResult(deps, account, plain);
setRefreshCookie(reply, config, result.refreshToken);
return reply.code(201).send({ ...result.body, sellerId });
```

> **FR-1, FR-2 covered here.**

#### 8c. Refresh handler

Remove `refreshBodySchema` and the `body` field from the route schema. Read cookie instead:

```typescript
// Schema change: remove body schema entirely from the route definition.

async (request, reply) => {
  if (!config.JWT_SECRET) {
    return reply.code(503).send({ error: "JWT_SECRET not configured" });
  }
  const plain = request.cookies[REFRESH_COOKIE_NAME];
  if (!plain) {
    return reply.code(401).send({ error: "missing_refresh_token" });
  }
  try {
    const result = await executeRefreshToken(deps, { refreshToken: plain });
    setRefreshCookie(reply, config, result.refreshToken); // rotate
    return reply.send(result.body);
  } catch (e) {
    clearRefreshCookie(reply); // clear stale cookie on token errors
    const mapped = mapAuthError(e, reply);
    if (mapped) return mapped;
    throw e;
  }
}
```

> **FR-3, FR-4, FR-5 covered here.**

#### 8d. Logout handler

Remove `preHandler: requireJwt(config)`. Remove `security: [{ bearerAuth: [] }]` from schema. Read cookie, call `executeLogout`, clear cookie:

```typescript
// Schema change: remove preHandler and bearerAuth security annotation.

async (request, reply) => {
  const plain = request.cookies[REFRESH_COOKIE_NAME];
  if (plain) {
    await executeLogout(deps, plain);
  }
  clearRefreshCookie(reply);
  return reply.code(204).send();
}
```

> **FR-6, FR-7 covered here.** Logout always returns `204` regardless of cookie presence — prevents information leakage.

---

## Data flow

### Login

```
POST /v1/auth/login  { email, password }
  → Zod validation (loginBodySchema — unchanged)
  → executeHumanLogin → buildLoginResult
      → signAccessToken + issueRefreshToken + persistRefreshToken (DB write)
      → returns LoginCommandResult { body, refreshToken }
  → route: reply.setCookie("dupply_rt", plainToken, { httpOnly, ... })
  → HTTP 200 { accessToken, tokenType, expiresInSeconds }
```

### Refresh

```
POST /v1/auth/refresh  (no body — dupply_rt cookie attached by browser)
  → request.cookies["dupply_rt"] extracted
  → executeRefreshToken → findAccountByRefreshToken (argon2 verify + TTL check)
      → issueRefreshToken + persistRefreshToken (DB write)
      → returns LoginCommandResult { body, refreshToken }
  → route: reply.setCookie("dupply_rt", newPlainToken, { httpOnly, ... })
  → HTTP 200 { accessToken, tokenType, expiresInSeconds }
```

### Logout

```
POST /v1/auth/logout  (no body — dupply_rt cookie attached by browser)
  → request.cookies["dupply_rt"] extracted
  → executeLogout → refreshTokenLookupKey (SHA-256) → DB lookup → clear tokens
  → route: reply.clearCookie("dupply_rt", { path: "/v1/auth" })
  → HTTP 204
```

---

## Files changed

| File | Change type |
|------|-------------|
| `package.json` | Modified — add `@fastify/cookie` |
| `src/plugins/cookie.ts` | **Added** |
| `src/lib/authCookie.ts` | **Added** |
| `src/server.ts` | Modified — register cookie plugin |
| `src/plugins/cors.ts` | Modified — add `credentials: true` |
| `src/application/account/commands/loginCommands.ts` | Modified — split `LoginResult` into `LoginResponseBody` + `LoginCommandResult`, remove `refreshToken`/`refreshExpiresInSeconds` from body |
| `src/application/account/commands/logoutCommands.ts` | Modified — accept `plainRefreshToken` instead of `accountId`, lookup by SHA-256 key |
| `src/routes/v1/auth.ts` | Modified — cookie read/write in all four handlers, remove `refreshBodySchema`, remove `requireJwt` from logout |

---

## Impact analysis

- **API compatibility:** **breaking** on `/v1/auth/login` and `/v1/auth/register` — `refreshToken` and `refreshExpiresInSeconds` are removed from the response body. Any existing client that reads these fields will break. The frontend is the only known consumer and will be updated in the subsequent frontend task.
- **`/v1/auth/refresh`:** breaking — no longer accepts a request body. Clients sending a body will receive a 400 from Zod if a body schema is present; after removal, extra body fields are silently ignored by Fastify.
- **Database:** no migration required. Columns `refreshToken` and `refreshTokenLookup` on `accounts` are unchanged.
- **Performance:** no change. SHA-256 lookup in logout is O(1) with the existing index on `refreshTokenLookup`.
- **Other modules:** `executeLogout` signature changes (`plainRefreshToken` instead of `accountId`). No other module calls `executeLogout` today. Verify with a grep before implementation.

---

## Test strategy

### Unit — `authCookie.ts`

| Scenario | Input | Expected |
|----------|-------|----------|
| `setRefreshCookie` in production | `NODE_ENV=production` | `secure: true` |
| `setRefreshCookie` in development | `NODE_ENV=development` | `secure: false` |
| `maxAge` is set from config | `JWT_REFRESH_TTL_SECONDS=3600` | `maxAge: 3600` |

### Unit — `executeLogout` (new signature)

| Scenario | Input | Expected |
|----------|-------|----------|
| Token exists in DB | valid plain token | clears `refreshToken` and `refreshTokenLookup` on the account |
| Token not found in DB | unknown token | resolves without throwing |

### Unit — `buildLoginResult` (new return shape)

| Scenario | Input | Expected |
|----------|-------|----------|
| Successful result | valid account + plain token | `body` has no `refreshToken`; `refreshToken` present on top-level result |

### Integration — auth routes (HTTP-level)

- `POST /v1/auth/login` success → `Set-Cookie` header present with `HttpOnly`, `SameSite=Lax`, `Path=/v1/auth`; response body has no `refreshToken`.
- `POST /v1/auth/refresh` without cookie → `401 { error: "missing_refresh_token" }`.
- `POST /v1/auth/refresh` with valid cookie → new `Set-Cookie` with rotated token; old token invalidated.
- `POST /v1/auth/refresh` with expired/invalid cookie → `401`; `Set-Cookie` clears `dupply_rt`.
- `POST /v1/auth/logout` with valid cookie → `204`; `Set-Cookie` clears `dupply_rt`; DB row cleared.
- `POST /v1/auth/logout` without cookie → `204`; no error.
- `POST /v1/auth/logout` without `Authorization` header → `204` (no longer requires JWT).

---

## Observability

- No new structured log lines needed. Existing Fastify request logging covers the endpoints.
- On refresh with invalid cookie: existing `AuthError` is caught and mapped to `401`. The `clearRefreshCookie` call ensures the client is cleaned up even on error.
- On logout with unknown token: silent success — no log noise. The cookie is still cleared.

---

## Open questions resolved

| Question (from PRD) | Decision |
|---------------------|----------|
| Cookie `Path=/v1/auth/refresh` — logout reads cookie manually | **Revised to `Path=/v1/auth`**. With `Path=/v1/auth/refresh`, the browser never sends the cookie to `/v1/auth/logout` because `HttpOnly` prevents JavaScript from reading it too — making manual forwarding impossible. `Path=/v1/auth` is the minimum viable scope that covers both endpoints. |
| `Secure` in development | Omit `Secure` when `NODE_ENV !== "production"` (implemented in `authCookie.ts`). |
