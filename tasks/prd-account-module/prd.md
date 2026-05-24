# Product Requirements Document — Account Module (v2)

## Overview

Introduce the **account** entity as the root authentication identity for all human platform users, replacing the legacy `platform_users` table and its associated auth model. This is **Module 1** in the Dupply v2 entity redesign (`entities-overview.mdc`, `module-account.mdc`).

Today, authentication reads from `platform_users`, which mixes human and service principals in one table, uses epoch-ms text timestamps, and issues short-lived JWTs without refresh-token rotation. The new model separates concerns: **accounts** hold credentials and session state; **profile tables** (`sellers`, `risk_analysts`, `admins`) hold role-specific data in a 1:1 relationship. **Payers** do not have accounts — they authenticate via magic link (Module 4, out of scope here).

**This PRD scopes the account module only:** schema, auth lifecycle (login / refresh / logout), account CRUD, JWT contract changes, and removal of all `platform_users` code and schema. Public registration, seller onboarding stages, and atomic account + profile creation are deferred to the seller and risk_analyst module PRDs.

## Goals

- Replace `platform_users` with `accounts` as the single source of truth for human authentication.
- Implement access-token + refresh-token auth with single-session semantics (one active refresh token per account in v1).
- Provide account lifecycle management (read, password update, soft delete) with correct authorization boundaries.
- Remove all legacy `platform_users` artifacts (schema, seeds, domain types, login queries, service-login endpoint).

**Success metrics:**

- 100% of human JWT logins resolve against `accounts`, not `platform_users`.
- Login, refresh, and logout flows pass automated tests covering happy path and key failure cases (invalid credentials, inactive account, deleted account, expired refresh token).
- No remaining runtime imports of `platformUsers` in `src/`.
- `platform_users` table and related code fully removed (greenfield — no data migration).

## User Stories

- As a **risk analyst**, I want to log in with email and password so that I can access the platform.
- As an **admin**, I want to soft-delete an account so that the user can no longer authenticate.
- As any **authenticated human user**, I want to refresh my access token so that I stay logged in without re-entering my password.
- As any **authenticated human user**, I want to log out so that my refresh token is invalidated on the server.
- As an **admin**, I want to read and manage accounts so that I can operate the platform.

**Main flow — login and session (v1):**

1. An account already exists (creation / seeding deferred to seller module PRD).
2. Caller submits `POST /v1/auth/login` with email and password.
3. System validates credentials and account status; issues `accessToken` (short TTL) and `refreshToken` (7 days); persists refresh token on the account row.
4. Caller uses `POST /v1/auth/refresh` with the refresh token to obtain a new access token (refresh token rotated).
5. Caller uses `POST /v1/auth/logout` (authenticated) to nullify the stored refresh token.

## Core Features

1. **Accounts table and invariants**
   - What it does: Persists human credentials (`email`, `passwordHash`), role (`seller` | `risk_analyst` | `admin`), status, refresh token, and soft-delete sentinel.
   - Why it matters: Establishes the foundation every other platform module depends on for auth.

2. **Auth endpoints (login, refresh, logout)**
   - What it does: Session lifecycle for human users with JWT access tokens and server-side refresh token storage.
   - Why it matters: Replaces the current access-only JWT model and aligns with v2 session semantics.

3. **Account CRUD**
   - What it does: Read, update password, and soft-delete accounts with admin-or-self authorization.
   - Why it matters: Enables platform operations and self-service password changes.

4. **Legacy `platform_users` removal**
   - What it does: Deletes schema, seeds, domain types, service-login, and all application code tied to `platform_users`.
   - Why it matters: Eliminates dual identity models and reduces maintenance burden.

## Functional Requirements

1. **FR-1:** The system shall persist human identities in an `accounts` table with fields: `id` (cuid2), `status` (`active` | `inactive`), `email` (unique, immutable in v1), `passwordHash`, `role` (`seller` | `risk_analyst` | `admin`), `refreshToken` (nullable), `createdAt`, `updatedAt`, `deletedAt`.

2. **FR-2:** Each account shall have exactly one role. Roles are mutually exclusive — an account is `seller` OR `risk_analyst` OR `admin`, never multiple.

3. **FR-3:** Payers shall not have accounts. Payer authentication remains out of scope (magic link, Module 4).

4. **FR-4:** An account with `deletedAt IS NOT NULL` shall not be able to log in or refresh, regardless of `status`.

5. **FR-5:** An account with `status = inactive` shall not be able to log in or refresh.

6. **FR-6:** Passwords shall never be stored in plain text. Only a password hash is persisted.

7. **FR-7:** New accounts shall be created with `status = active` by default. Seller approval workflows (seller profile status `created` → `active` after risk analyst review) are out of scope — defined in the seller module PRD.

8. **FR-8:** `POST /v1/auth/login` shall validate email and password, reject inactive or soft-deleted accounts, and return `accessToken`, `refreshToken`, `tokenType`, and expiry metadata.

9. **FR-9:** Access tokens shall expire in 15 minutes. Refresh tokens shall expire in 7 days.

10. **FR-10:** The JWT payload shall include `sub` (account id), `role`, and `profileId`. Until profile modules exist (seller, risk_analyst, admin), `profileId` shall be a **mocked placeholder value** with a documented observation that it will be replaced by the real linked profile id once those modules are implemented.

11. **FR-11:** v1 shall support only one active session per account. The most recent refresh token overwrites the previous one on login or refresh.

12. **FR-12:** `POST /v1/auth/refresh` shall validate the refresh token against the stored value on the account, issue a new access token, and rotate the refresh token (invalidating the previous one).

13. **FR-13:** `POST /v1/auth/logout` shall require a valid access token and nullify the stored refresh token on the account.

14. **FR-14:** `GET /v1/accounts/:id` shall return account data (excluding password hash and refresh token) to the account owner or an admin.

15. **FR-15:** `PATCH /v1/accounts/:id` shall allow password update by the account owner or admin. Email change is **not** supported in v1.

16. **FR-16:** `DELETE /v1/accounts/:id` shall soft-delete the account (set `deletedAt`) and shall be restricted to admin actors.

17. **FR-17:** Standard read queries shall exclude soft-deleted accounts unless explicitly requested by an admin-only listing endpoint (listing endpoint is out of scope for v1 unless needed for admin operations).

18. **FR-18:** All `platform_users` schema, seed scripts, domain types (`PlatformUserAuthSnapshot`, `principalKind`), `POST /v1/auth/service-login`, and application queries shall be removed. No data migration from `platform_users` to `accounts` — greenfield replacement.

19. **FR-19:** Auth error responses shall preserve the existing error-code pattern (`invalid_credentials`, `account_inactive`, etc.) where applicable, mapped to appropriate HTTP status codes.

20. **FR-20:** Timestamps shall use native PostgreSQL `timestamp` columns (`created_at`, `updated_at`, `deleted_at`), following v2 cross-cutting standards. Legacy epoch-ms text columns shall not be used for new account tables.

## Technical Constraints

- Scope: backend only (`src/`), no frontend changes.
- **Migration required:** new `accounts` table; drop `platform_users` and related indexes/FKs.
- **Greenfield approach:** delete all `platform_users` data and code. Do not migrate existing rows.
- **Breaking change expected** on auth API contract:
  - Login response adds `refreshToken`.
  - JWT payload replaces `principalKind` with `profileId`.
  - `POST /v1/auth/service-login` removed.
  - New endpoints: `refresh`, `logout`, account CRUD.
- **Deferred dependencies:** `receivables` currently FKs to `platform_users`; `ramp_quotes.user_id` / `ramp_orders.user_id` optionally reference platform users. These will be addressed in receivable and ramp module PRDs — not blocking account module implementation.
- System / worker authentication via `X-Dupply-Api-Key` is unchanged.
- Automation agent auth (future n8n) via `X-Dupply-Api-Key` is deferred — no n8n integration exists today (only a dev seed placeholder for `risk_analyst_agent`).
- **Account seeding deferred** to the seller module PRD (next in sequence). No dev seed script for accounts in this feature.
- **`profileId` in JWT mocked** until profile tables exist — Tech Spec must document the placeholder and the follow-up when seller/risk_analyst/admin modules land.
- Details of hashing algorithm, layer design, repository pattern, and Zod schemas belong in the Tech Spec.

## Out of Scope

- **`risk_analyst_agent` role** and service-account authentication (deferred post-v1).
- **`POST /v1/auth/service-login`** — removed with `platform_users`; automation auth TBD.
- **`POST /v1/auth/register`** and atomic account + profile creation — deferred to seller / risk_analyst module PRDs. Public self-registration and seller onboarding stages (`created` → `active` after risk analyst approval) belong to the seller module.
- Seller profile status machine and gated platform access after registration.
- Payer entity, magic-link auth, and payer-facing routes (Module 4).
- Full seller / wallet / risk_analyst / admin profile CRUD (Modules 2 and 3).
- Receivable schema migration (`seller_user_id` → `seller_id`, etc.) — Module 5.
- Ramp `user_id` column reassignment — ramp module PRD.
- Account listing / search endpoints for admin (v1 — add only if admin soft-delete workflow requires it).
- Email change flow (deferred to v2).
- Multi-session / device management (v1 = single refresh token per account).
- Password reset / forgot-password flow.
- Supabase Auth migration.
- Frontend registration or login UI.

## Decisions

| # | Question | Decision |
|---|----------|----------|
| D-1 | `risk_analyst_agent` role in v1? | **Out of scope.** Deferred to a future automation PRD. |
| D-2 | How does the n8n automation agent authenticate? | **No n8n agent exists today** — only a dev seed entry (`risk_analyst_agent` service account in `platform_users`). Likely `X-Dupply-Api-Key` when built; **decision deferred.** `service-login` endpoint will be removed with `platform_users`. |
| D-3 | Public register and seller onboarding? | **Deferred.** Register + seller approval flow (`created` → `active`) belongs to the seller module PRD. Account module creates accounts as `active`; seller gating logic comes later. |
| D-4 | Migrate existing `platform_users` data? | **No.** Delete everything related to `platform_users` — greenfield. Re-seed dev accounts as needed. |
| D-5 | Receivables FK migration? | **Deferred** to receivable module PRD (Module 5). |
| D-6 | Ramp `user_id` columns? | **Deferred** to ramp module PRD. |
| D-7 | Seed strategy for dev/staging accounts? | **Deferred** to seller module PRD (next in sequence). Account module does not ship a seed script. |
| D-8 | `profileId` in JWT before profile tables exist? | **Mocked placeholder** for now, with an explicit observation in code/docs that it will be wired to the real profile id when seller / risk_analyst / admin modules are implemented. |
