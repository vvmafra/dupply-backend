# Tech Spec — Account Module (v2)

## Overview

Replace the legacy `platform_users` identity model with a dedicated `accounts` table as the single source of truth for human authentication. This module delivers: the `accounts` schema and migration, auth lifecycle endpoints (`login`, `refresh`, `logout`), account CRUD (`GET`, `PATCH` password, `DELETE` soft-delete), JWT contract changes (`profileId` replaces `principalKind`, access + refresh tokens), and full removal of `platform_users` code and schema.

**Not in scope:** public registration, account seeding, atomic account + profile creation, payer magic-link auth, admin account listing/search, email change, password reset, multi-session support, `risk_analyst_agent` / service-login, and receivable/ramp FK migrations (deferred to later module PRDs).

Reference: [`tasks/prd-account-module/prd.md`](prd.md), [`.cursor/rules/module-account.mdc`](../../.cursor/rules/module-account.mdc).

---

## Architecture overview

Follow the canonical auth split documented in `docs/ARCHITECTURE-RULES.md` §9.1. Introduce a bounded **`account`** context under `domain/account` and `application/account`, while keeping shared JWT utilities in `lib/`.

```
Domain (account/)
  ├── types.ts          — AccountRole, AccountStatus, AccountAuthSnapshot, AccountPublicView
  ├── errors.ts         — AccountError, AuthError (extended codes)
  └── policies.ts       — login guards, soft-delete/inactive checks, authorization (self | admin)

Application (account/)
  ├── commands/
  │   ├── loginCommands.ts      — executeHumanLogin (refactored from auth/)
  │   ├── refreshCommands.ts    — executeRefreshToken
  │   ├── logoutCommands.ts     — executeLogout
  │   ├── updatePasswordCommand.ts
  │   └── softDeleteAccountCommand.ts
  └── queries/
      └── getAccountQuery.ts

Infrastructure
  ├── db/schema.{ts,pg.ts}  — accounts table; drop platform_users
  └── lib/jwt.ts            — AccessTokenPayload with profileId
  └── lib/refreshToken.ts     — generate + hash opaque refresh tokens

HTTP (routes/)
  ├── v1/auth.ts      — login, refresh, logout (remove service-login)
  └── v1/accounts.ts  — GET /:id, PATCH /:id, DELETE /:id
```

**FR traceability:** FR-1–FR-7, FR-20 → schema + domain policies; FR-8–FR-13 → auth commands + routes; FR-14–FR-17 → account queries/commands + routes; FR-18 → legacy removal section; FR-19 → error mapping.

---

## Component design

### 1. Database schema — `accounts` table

**Files:** `src/db/schema.ts`, `src/db/schema.pg.ts`, `src/db/schema.runtime.ts`, new Drizzle migration

Add the `accounts` table per `module-account.mdc`. Use native PostgreSQL `timestamp` columns (SQLite: `integer` mode with Drizzle `timestamp` or equivalent — match existing v2 cross-cutting pattern when dual-schema is updated).

```typescript
// After — src/db/schema.pg.ts (Postgres canonical)
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const ACCOUNT_STATUSES = ["active", "inactive"] as const;
export const ACCOUNT_ROLES = ["seller", "risk_analyst", "admin"] as const;

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("active"),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    refreshToken: text("refresh_token"), // nullable — Argon2 hash of opaque token
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("accounts_role_idx").on(t.role)],
);
```

**Migration steps (single migration file):**

1. `CREATE TABLE accounts (...)` with indexes.
2. Drop FK constraints on `receivables.seller_user_id` and `receivables.payer_user_id` referencing `platform_users` (columns remain as plain `text` until Module 5 — PRD D-5).
3. `DROP TABLE platform_users` (and its indexes).

**Greenfield:** no data copy from `platform_users`. Dev re-seeding deferred to seller module PRD (PRD D-7).

**Receivable command impact:** `application/receivable/commands/receivableCommands.ts` currently validates seller/payer IDs against `platformUsers`. Replace with:
- Seller: lookup in `accounts` where `role = 'seller'` and `deleted_at IS NULL`.
- Payer: skip DB existence check for v1 (payer entity not yet implemented); accept opaque `payerUserId` string until Module 4/5.

**FR coverage:** FR-1, FR-2, FR-3, FR-6, FR-7, FR-18, FR-20.

---

### 2. Domain — account types and policies

**Files:** `src/domain/account/types.ts`, `src/domain/account/errors.ts`, `src/domain/account/policies.ts`

Replace `PlatformUserAuthSnapshot` / `principalKind` with account-centric types. Retire `src/domain/auth/types.ts` service-principal types.

```typescript
// src/domain/account/types.ts
export const ACCOUNT_ROLES = ["seller", "risk_analyst", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "inactive"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Fields loaded for auth flows (login / refresh). */
export type AccountAuthSnapshot = {
  id: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  passwordHash: string;
  refreshToken: string | null;
  deletedAt: Date | null;
};

/** Safe API representation — no secrets. */
export type AccountPublicView = {
  id: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
};
```

```typescript
// src/domain/account/policies.ts
export function requireLoginCandidate(
  account: AccountAuthSnapshot | undefined,
): AccountAuthSnapshot {
  if (!account) {
    throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  }
  return account;
}

export function assertCanAuthenticate(account: AccountAuthSnapshot): void {
  if (account.deletedAt !== null) {
    throw new AuthError(AUTH_ERROR_CODES.ACCOUNT_DELETED);
  }
  if (account.status !== "active") {
    throw new AuthError(AUTH_ERROR_CODES.ACCOUNT_INACTIVE);
  }
}

export function assertCanReadAccount(
  actor: { sub: string; role: AccountRole },
  accountId: string,
): void {
  if (actor.sub === accountId || actor.role === "admin") return;
  throw new AccountError(ACCOUNT_ERROR_CODES.FORBIDDEN);
}

export function assertCanMutateAccount(
  actor: { sub: string; role: AccountRole },
  accountId: string,
): void {
  assertCanReadAccount(actor, accountId);
}

export function assertCanSoftDeleteAccount(actor: { role: AccountRole }): void {
  if (actor.role !== "admin") {
    throw new AccountError(ACCOUNT_ERROR_CODES.FORBIDDEN);
  }
}
```

Extend error codes (FR-19):

```typescript
// src/domain/account/errors.ts
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: "invalid_credentials",
  ACCOUNT_INACTIVE: "account_inactive",
  ACCOUNT_DELETED: "account_deleted",
  INVALID_REFRESH_TOKEN: "invalid_refresh_token",
  REFRESH_TOKEN_EXPIRED: "refresh_token_expired",
} as const;

export const ACCOUNT_ERROR_CODES = {
  NOT_FOUND: "account_not_found",
  FORBIDDEN: "forbidden",
} as const;
```

**Delete:** `requireServiceLoginCandidate`, `AuthenticatedServiceUser`, all `principalKind` references.

**FR coverage:** FR-2, FR-4, FR-5, FR-6, FR-14, FR-15, FR-16, FR-19.

---

### 3. JWT and refresh token utilities

**Files:** `src/lib/jwt.ts`, `src/lib/refreshToken.ts` (new), `src/config.ts`, `.env.example`, `API.md`

**Access token payload change** — replace `principalKind` with `profileId`:

```typescript
// After — src/lib/jwt.ts
export type AccessTokenPayload = {
  sub: string;
  role: AccountRole;
  profileId: string;
};

export async function signAccessToken(
  config: AppConfig,
  payload: AccessTokenPayload,
): Promise<string> {
  return new jose.SignJWT({
    role: payload.role,
    profileId: payload.profileId,
  })
    // ... unchanged header / issuer / exp
    .sign(secret);
}
```

**ProfileId placeholder (FR-10, PRD D-8):**

Until seller / risk_analyst / admin profile tables exist (Modules 2–3), derive a deterministic mock:

```typescript
// src/domain/account/profileId.ts
/** TEMP: replace with real profile FK lookup when profile modules land. */
export function mockProfileId(accountId: string, role: AccountRole): string {
  return `placeholder-${role}-${accountId}`;
}
```

Add a `@todo(module-2|3)` comment and a one-line note in `API.md` JWT section.

**Config changes (FR-9):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `JWT_ACCESS_TTL_SECONDS` | `900` (15 min) | Access token lifetime |
| `JWT_REFRESH_TTL_SECONDS` | `604800` (7 days) | Refresh token lifetime |

**Refresh token strategy (FR-11, FR-12):**

- Generate opaque token: `randomBytes(32).toString("base64url")`.
- Persist **Argon2 hash** in `accounts.refresh_token` (consistent with password hashing; never store plain refresh tokens).
- Return plain token once to client in login/refresh response.
- On refresh: verify presented token against stored hash; on success rotate (new token + new hash, overwriting previous — single-session semantics).
- Store refresh token **issued-at** implicitly via rotation; expiry enforced by comparing token age embedded in a prefixed payload or by storing `refreshTokenIssuedAt` — **recommended:** store `{ hash, issuedAtMs }` as JSON in `refresh_token` column to avoid a schema change, or add `refresh_token_issued_at timestamp` if cleaner. Minimal v1 approach: encode `issuedAtMs` alongside hash:

```typescript
// src/lib/refreshToken.ts
export type StoredRefreshToken = { hash: string; issuedAtMs: number };

export async function issueRefreshToken(): Promise<{ plain: string; stored: StoredRefreshToken }> {
  const plain = randomBytes(32).toString("base64url");
  const hash = await argon2.hash(plain);
  return { plain, stored: { hash, issuedAtMs: Date.now() } };
}

export function serializeStoredRefreshToken(stored: StoredRefreshToken): string {
  return JSON.stringify(stored);
}

export function parseStoredRefreshToken(raw: string | null): StoredRefreshToken | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredRefreshToken;
    if (typeof parsed.hash === "string" && typeof parsed.issuedAtMs === "number") return parsed;
  } catch { /* fall through */ }
  return null;
}
```

**FR coverage:** FR-9, FR-10, FR-11, FR-12.

---

### 4. Application — auth commands

**Files:** `src/application/account/commands/loginCommands.ts`, `refreshCommands.ts`, `logoutCommands.ts`

Refactor existing `application/auth/commands/loginCommands.ts` into the account context. Remove `executeServiceLogin`.

```typescript
// executeHumanLogin — after
export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
  refreshExpiresInSeconds: number;
};

export async function executeHumanLogin(deps: AppDeps, input: HumanLoginInput): Promise<LoginResult> {
  const row = await findAccountByEmail(deps, input.email); // WHERE deleted_at IS NULL
  const candidate = requireLoginCandidate(row);
  const ok = await argon2.verify(candidate.passwordHash, input.password);
  if (!ok) throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
  assertCanAuthenticate(candidate);

  const { plain, stored } = await issueRefreshToken();
  await persistRefreshToken(deps, candidate.id, stored);

  const accessToken = await signAccessToken(deps.config, {
    sub: candidate.id,
    role: candidate.role,
    profileId: mockProfileId(candidate.id, candidate.role),
  });

  return {
    accessToken,
    refreshToken: plain,
    tokenType: "Bearer",
    expiresInSeconds: deps.config.JWT_ACCESS_TTL_SECONDS,
    refreshExpiresInSeconds: deps.config.JWT_REFRESH_TTL_SECONDS,
  };
}
```

```typescript
// executeRefreshToken
export async function executeRefreshToken(
  deps: AppDeps,
  input: { refreshToken: string },
): Promise<LoginResult> {
  const account = await findAccountByRefreshToken(deps, input.refreshToken);
  // findAccountByRefreshToken: scan is unacceptable — lookup by email not possible.
  // Instead: store a refresh token lookup key OR iterate — **better approach:**
  // Add refresh_token_lookup text column with SHA-256 of plain token for indexed lookup.
```

**Design decision — refresh token lookup:**

Scanning all accounts for Argon2 verify is O(N). For v1 with low account count this is acceptable short-term, but the spec recommends adding a **`refresh_token_lookup`** column (`text`, indexed, nullable) storing `sha256(plainToken)` for direct row lookup, then Argon2-verify the stored hash. This keeps single-session semantics and avoids full-table scans. Include in migration.

```typescript
// findAccountByRefreshToken (indexed lookup + verify)
const lookup = sha256(input.refreshToken);
const [row] = await deps.db.select().from(accounts)
  .where(and(eq(accounts.refreshTokenLookup, lookup), isNull(accounts.deletedAt)))
  .limit(1);
if (!row?.refreshToken) throw new AuthError(AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
const stored = parseStoredRefreshToken(row.refreshToken);
if (!stored || Date.now() - stored.issuedAtMs > deps.config.JWT_REFRESH_TTL_SECONDS * 1000) {
  throw new AuthError(AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED);
}
const valid = await argon2.verify(stored.hash, input.refreshToken);
if (!valid) throw new AuthError(AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
assertCanAuthenticate(toAuthSnapshot(row));
// rotate token + issue new access token (same as login)
```

```typescript
// executeLogout
export async function executeLogout(deps: AppDeps, accountId: string): Promise<void> {
  await deps.db.update(accounts)
    .set({ refreshToken: null, refreshTokenLookup: null, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));
}
```

**FR coverage:** FR-4, FR-5, FR-8, FR-11, FR-12, FR-13.

---

### 5. Application — account CRUD

**Files:** `src/application/account/queries/getAccountQuery.ts`, `src/application/account/commands/updatePasswordCommand.ts`, `src/application/account/commands/softDeleteAccountCommand.ts`

**Query — get account (FR-14, FR-17):**

```typescript
export async function executeGetAccount(
  deps: AppDeps,
  actor: { sub: string; role: AccountRole },
  accountId: string,
): Promise<AccountPublicView> {
  assertCanReadAccount(actor, accountId);
  const row = await deps.db.select(/* public columns */).from(accounts)
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
    .limit(1);
  if (!row[0]) throw new AccountError(ACCOUNT_ERROR_CODES.NOT_FOUND);
  return toPublicView(row[0]);
}
```

**Command — update password (FR-15):**

```typescript
export async function executeUpdatePassword(
  deps: AppDeps,
  actor: { sub: string; role: AccountRole },
  accountId: string,
  input: { password: string },
): Promise<void> {
  assertCanMutateAccount(actor, accountId);
  const passwordHash = await argon2.hash(input.password);
  await deps.db.update(accounts)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
}
```

Password update does **not** invalidate the current refresh token in v1 (optional hardening — note as future improvement).

**Command — soft delete (FR-16):**

```typescript
export async function executeSoftDeleteAccount(
  deps: AppDeps,
  actor: { role: AccountRole },
  accountId: string,
): Promise<void> {
  assertCanSoftDeleteAccount(actor);
  const now = new Date();
  await deps.db.update(accounts)
    .set({
      deletedAt: now,
      updatedAt: now,
      refreshToken: null,
      refreshTokenLookup: null,
    })
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
}
```

**FR coverage:** FR-14, FR-15, FR-16, FR-17.

---

### 6. HTTP routes

**Files:** `src/routes/v1/auth.ts`, `src/routes/v1/accounts.ts` (new), `src/server.ts`, `src/types/fastify.d.ts`, `src/plugins/jwt-auth.ts`

**Auth routes — modify `src/routes/v1/auth.ts`:**

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/v1/auth/login` | — | `{ email, password }` | `{ accessToken, refreshToken, tokenType, expiresInSeconds, refreshExpiresInSeconds }` |
| POST | `/v1/auth/refresh` | — | `{ refreshToken }` | same as login |
| POST | `/v1/auth/logout` | Bearer JWT | — | `204 No Content` |

Remove `POST /v1/auth/service-login` route and `serviceLoginBodySchema`.

Extend `mapAuthError`:

| Code | HTTP |
|------|------|
| `invalid_credentials` | 401 |
| `invalid_refresh_token` | 401 |
| `refresh_token_expired` | 401 |
| `account_inactive` | 403 |
| `account_deleted` | 403 |

**Account routes — new `src/routes/v1/accounts.ts`:**

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/v1/accounts/:id` | Bearer JWT | — | `AccountPublicView` |
| PATCH | `/v1/accounts/:id` | Bearer JWT | `{ password }` | `204` or updated view |
| DELETE | `/v1/accounts/:id` | Bearer JWT (admin) | — | `204` |

Zod schemas at HTTP edge only. Each handler ≤ ~50 lines — delegate to application layer.

**Update `request.auth` type:**

```typescript
// src/types/fastify.d.ts
auth?: {
  sub: string;
  role: AccountRole;
  profileId: string;
};
```

Update `plugins/jwt-auth.ts` to set `profileId` instead of `principalKind`.

Register account routes in `server.ts` behind `requireJwt` hook (same pattern as receivables).

**FR coverage:** FR-8, FR-12, FR-13, FR-14, FR-15, FR-16, FR-18, FR-19.

---

### 7. Legacy removal

**Delete or fully replace:**

| Artifact | Action |
|----------|--------|
| `platformUsers` in `schema.ts`, `schema.pg.ts` | Delete table definition |
| `export const platformUsers` in `schema.runtime.ts` | Replace with `accounts` export |
| `scripts/seed-platform-dev.ts` | Delete (seeding deferred to seller PRD) |
| `executeServiceLogin`, `requireServiceLoginCandidate` | Delete |
| `PlatformUserAuthSnapshot`, `principalKind` types | Delete |
| `POST /v1/auth/service-login` route | Delete |
| `domain/auth/policies.test.ts` | Move/replace with `domain/account/policies.test.ts` |
| References in `API.md`, `README.md`, `ARCHITECTURE-RULES.md` §9.1 | Update to account model |

**Keep `domain/auth/` temporarily?** No — consolidate into `domain/account/` to avoid split contexts. Update imports across `src/`.

**FR coverage:** FR-18.

---

## Data flow

### Login

```
POST /v1/auth/login
  → Zod { email, password }
  → executeHumanLogin(deps, input)
      → findAccountByEmail (deleted_at IS NULL)
      → requireLoginCandidate + argon2.verify
      → assertCanAuthenticate
      → issueRefreshToken → UPDATE accounts SET refresh_token, refresh_token_lookup
      → signAccessToken({ sub, role, profileId: mockProfileId(...) })
  → 200 { accessToken, refreshToken, tokenType, expiresInSeconds, refreshExpiresInSeconds }
```

### Refresh

```
POST /v1/auth/refresh
  → Zod { refreshToken }
  → executeRefreshToken
      → lookup by refresh_token_lookup (sha256)
      → verify hash + expiry
      → assertCanAuthenticate
      → rotate refresh token (overwrite — FR-11)
      → signAccessToken
  → 200 (same shape as login)
```

### Logout

```
POST /v1/auth/logout  [Bearer JWT]
  → requireJwt → request.auth.sub
  → executeLogout(deps, accountId)
      → SET refresh_token = NULL, refresh_token_lookup = NULL
  → 204
```

### Get account

```
GET /v1/accounts/:id  [Bearer JWT]
  → requireJwt
  → executeGetAccount(deps, request.auth, params.id)
      → assertCanReadAccount (self | admin)
      → SELECT (exclude password_hash, refresh_token, deleted rows)
  → 200 AccountPublicView
```

---

## Files changed

| File | Change type |
|------|-------------|
| `src/db/schema.ts` | Modified — add `accounts`, remove `platformUsers`, drop receivable FK refs |
| `src/db/schema.pg.ts` | Modified — same |
| `src/db/schema.runtime.ts` | Modified — export `accounts` |
| `drizzle/0004_accounts_drop_platform_users.sql` | Added — migration |
| `src/domain/account/types.ts` | Added |
| `src/domain/account/errors.ts` | Added |
| `src/domain/account/policies.ts` | Added |
| `src/domain/account/policies.test.ts` | Added |
| `src/domain/account/profileId.ts` | Added — mocked profileId helper |
| `src/domain/auth/types.ts` | Deleted |
| `src/domain/auth/errors.ts` | Deleted (merged into account) |
| `src/domain/auth/policies.ts` | Deleted (merged into account) |
| `src/domain/auth/policies.test.ts` | Deleted (replaced) |
| `src/application/account/commands/loginCommands.ts` | Added (from auth/) |
| `src/application/account/commands/refreshCommands.ts` | Added |
| `src/application/account/commands/logoutCommands.ts` | Added |
| `src/application/account/commands/updatePasswordCommand.ts` | Added |
| `src/application/account/commands/softDeleteAccountCommand.ts` | Added |
| `src/application/account/queries/getAccountQuery.ts` | Added |
| `src/application/auth/commands/loginCommands.ts` | Deleted |
| `src/application/receivable/commands/receivableCommands.ts` | Modified — validate seller via `accounts` |
| `src/lib/jwt.ts` | Modified — `profileId` payload |
| `src/lib/refreshToken.ts` | Added |
| `src/config.ts` | Modified — TTL defaults |
| `.env.example` | Modified — new TTL vars |
| `src/routes/v1/auth.ts` | Modified — refresh, logout; remove service-login |
| `src/routes/v1/accounts.ts` | Added |
| `src/plugins/jwt-auth.ts` | Modified — `profileId` |
| `src/types/fastify.d.ts` | Modified — `profileId` |
| `src/server.ts` | Modified — register account routes |
| `scripts/seed-platform-dev.ts` | Deleted |
| `package.json` | Modified — add `@paralleldrive/cuid2` |
| `API.md` | Modified — auth + account endpoints |
| `README.md` | Modified — endpoint list |
| `docs/ARCHITECTURE-RULES.md` | Modified — update canonical auth example |

---

## Impact analysis

- **API compatibility:** **Breaking.** Login response adds `refreshToken` and `refreshExpiresInSeconds`. JWT claim `principalKind` → `profileId`. `POST /v1/auth/service-login` removed. New endpoints: `/v1/auth/refresh`, `/v1/auth/logout`, `/v1/accounts/:id`. Default access TTL changes from 3600s to 900s.
- **Database:** Migration adds `accounts`; drops `platform_users`; drops receivable FK constraints (columns unchanged). Adds `refresh_token_lookup` index column for O(1) refresh lookup.
- **Performance:** Refresh lookup via SHA-256 index is O(1). Argon2 verify per refresh is intentional cost. No full-table scan.
- **Other modules:**
  - **Receivables:** seller validation switches to `accounts`; payer validation deferred. Existing receivable rows may reference deleted platform user IDs — acceptable in greenfield dev.
  - **Ramp:** `user_id` columns unchanged (Module 8 PRD).
  - **JWT consumers:** Any code reading `request.auth.principalKind` must use `profileId` (currently only receivables uses `auth.role` and `auth.sub` — no breaking change there).

---

## Test strategy

### Unit — domain/account/policies

| Scenario | Input | Expected |
|----------|-------|----------|
| requireLoginCandidate — missing | `undefined` | `AuthError(invalid_credentials)` |
| assertCanAuthenticate — deleted | `deletedAt != null` | `AuthError(account_deleted)` |
| assertCanAuthenticate — inactive | `status = inactive` | `AuthError(account_inactive)` |
| assertCanReadAccount — self | `actor.sub === accountId` | passes |
| assertCanReadAccount — admin | `role = admin` | passes |
| assertCanReadAccount — other user | seller viewing another id | `AccountError(forbidden)` |
| assertCanSoftDeleteAccount — non-admin | `role = seller` | `AccountError(forbidden)` |

### Unit — lib/refreshToken

| Scenario | Input | Expected |
|----------|-------|----------|
| issue + verify round-trip | generated plain token | argon2.verify succeeds |
| expired token | `issuedAtMs` older than TTL | `AuthError(refresh_token_expired)` |
| rotation invalidates old | login then refresh | old refresh token rejected |

### Integration — auth commands (in-memory or test DB)

- Happy path login returns both tokens; `accounts.refresh_token` populated.
- Second login overwrites refresh token (single session).
- Refresh rotates token; old refresh fails.
- Logout nullifies refresh; subsequent refresh fails.
- Inactive account login → 403 `account_inactive`.
- Soft-deleted account login → 403 `account_deleted`.
- Wrong password → 401 `invalid_credentials`.

### Integration — account CRUD

- Owner GET own account → 200, no secrets in body.
- Admin GET any account → 200.
- Non-admin GET other account → 403.
- PATCH password → subsequent login with new password succeeds.
- Admin DELETE → account soft-deleted; login/refresh rejected.

### API / E2E

- `POST /v1/auth/login` → `POST /v1/auth/refresh` → authenticated `GET /v1/accounts/:id` → `POST /v1/auth/logout`.
- Verify JWT payload contains `profileId` (mock format) and not `principalKind`.

---

## Observability

- **Logs:** Application commands log at `debug` on failed login (no password/token values). Log `accountId` on logout and soft-delete at `info`.
- **Error handling:** All auth/account errors surface as `{ error: "<code>" }` JSON with stable codes (FR-19). Unexpected errors propagate to Fastify default 500 handler.
- **Security:** Never log `refreshToken`, `password`, or full JWT. Redact `Authorization` header in any request logging middleware.

---

## Open questions resolved

| Question (from PRD) | Decision |
|---------------------|----------|
| D-1: `risk_analyst_agent` in v1? | Out of scope. Remove service-login; no agent role in `accounts`. |
| D-2: n8n agent auth? | Deferred. `service-login` removed with `platform_users`. |
| D-3: Public register / seller onboarding? | Deferred to seller module PRD. Account module exposes CRUD but no public register route. |
| D-4: Migrate `platform_users` data? | No. Greenfield drop. |
| D-5: Receivables FK migration? | Drop FK constraints only; column rename to `seller_id` deferred to Module 5. Seller existence validated against `accounts` in receivable create command. |
| D-6: Ramp `user_id` columns? | Unchanged in this module. |
| D-7: Dev seed strategy? | No seed in account module. Seller module PRD owns re-seeding. |
| D-8: `profileId` before profile tables? | Use `mockProfileId(accountId, role)` returning `placeholder-{role}-{accountId}`. Replace when Modules 2–3 add profile tables. |
| Hashing algorithm? | **Argon2id** (already used; keep for passwords and refresh token hashes). |
| Refresh token storage — plain or hashed? | **Hashed** (Argon2) with SHA-256 lookup key for indexed retrieval. |
| Receivable commands without `platform_users`? | Validate seller against `accounts`; accept payer ID without DB lookup until payer module. |
| Admin account listing endpoint? | Out of scope for v1 unless soft-delete workflow blocked — not needed for DELETE-by-id flow. |
