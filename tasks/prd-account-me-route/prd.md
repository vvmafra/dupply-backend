# Product Requirements Document — Account "Me" Route

## Overview

The account module already exposes `GET /v1/accounts/:id` for reading the authenticated user's account (or any account, when the actor is an admin). Frontend clients integrating with the Dupply API need a **session-bootstrap read** that does not require extracting the account id from the JWT `sub` claim before calling the API.

This PRD adds **`GET /v1/accounts/me`** — a convenience alias that resolves the target account from the authenticated JWT and returns the same safe account representation as `GET /v1/accounts/:id`. It unblocks frontend session hydration (currently blocked on a non-existent `GET /users/me` contract) without introducing a new resource model or changing existing account CRUD semantics.

The endpoint reuses existing authorization rules (account owner or admin) and the existing account read query. No new database tables, migrations, or response shapes are required for v1.

## Goals

- Provide a standard, self-describing endpoint for "who am I?" account reads in authenticated sessions.
- Eliminate the need for clients to parse JWT `sub` solely to call `GET /v1/accounts/:id` on session restore.
- Preserve full backward compatibility with `GET /v1/accounts/:id` (no breaking changes).

**Success metrics:**

- Authenticated callers can retrieve their own account via `GET /v1/accounts/me` without supplying an account id in the URL.
- Response body and error semantics are identical to `GET /v1/accounts/:id` for the same actor and account.
- Automated route tests cover happy path, unauthorized (no JWT), and forbidden (non-owner non-admin attempting to read another account via `:id` remains unchanged).
- OpenAPI/Swagger documents the new route under the **Accounts** tag.

## User Stories

- As an **authenticated platform user** (seller, risk analyst, or admin), I want to fetch my current account via a fixed URL so that the frontend can validate my session on page reload without decoding JWT claims.
- As a **frontend developer**, I want a conventional `/me` alias so that auth hydration matches common API patterns and reduces client-side coupling to JWT structure.
- As an **admin**, I want existing `GET /v1/accounts/:id` behavior unchanged so that I can still read any account by id when needed.

**Main flow — session restore (consumer side):**

1. Client holds a valid access token (from login or refresh).
2. Client calls `GET /v1/accounts/me` with `Authorization: Bearer <token>`.
3. System resolves the account id from JWT `sub`, applies existing read authorization, and returns the public account view (email, role, status, timestamps — no secrets).
4. Client updates local session state; if the account is inactive or not found, the client treats the session as invalid.

## Core Features

1. **GET /v1/accounts/me alias**
   - What it does: Returns the authenticated actor's account using JWT `sub` as the account id, delegating to the same read logic as `GET /v1/accounts/:id`.
   - Why it matters: Improves developer experience and aligns with frontend integration expectations without duplicating business rules.

2. **Consistent authorization and errors**
   - What it does: Applies the same owner-or-admin policy and error codes (`forbidden`, `not_found`, `unauthorized`) as the existing account read endpoint.
   - Why it matters: Callers can swap between `/me` and `/:id` without learning a new contract.

3. **API documentation**
   - What it does: Registers the route in Swagger with summary, security (`bearerAuth`), and response schema consistent with account read.
   - Why it matters: Discoverability for frontend and external integrators.

## Functional Requirements

1. **FR-1:** The system shall expose `GET /v1/accounts/me` as an authenticated route (Bearer JWT required).

2. **FR-2:** `GET /v1/accounts/me` shall resolve the target account id from the JWT `sub` claim of the authenticated request.

3. **FR-3:** `GET /v1/accounts/me` shall return the same response body as `GET /v1/accounts/:id` when `:id` equals the JWT `sub` — i.e. the existing public account view (`id`, `email`, `role`, `status`, `createdAt`, `updatedAt`), excluding `passwordHash` and `refreshToken`.

4. **FR-4:** `GET /v1/accounts/me` shall enforce the same authorization rules as `GET /v1/accounts/:id` (account owner or admin). For a normal authenticated user calling `/me`, authorization shall always succeed when the account exists and is not soft-deleted.

5. **FR-5:** `GET /v1/accounts/me` shall return `401` when no valid JWT is present or the token is invalid/expired.

6. **FR-6:** `GET /v1/accounts/me` shall return `404` with error code `not_found` when the account referenced by JWT `sub` does not exist or is soft-deleted (consistent with `GET /v1/accounts/:id`).

7. **FR-7:** The literal path segment `me` shall not be treated as a valid account id on `GET /v1/accounts/:id` — i.e. `GET /v1/accounts/me` must be registered so that `me` is not interpreted as a cuid2 id parameter.

8. **FR-8:** Existing `GET /v1/accounts/:id`, `PATCH /v1/accounts/:id`, and `DELETE /v1/accounts/:id` behavior shall remain unchanged (no breaking changes).

9. **FR-9:** The new route shall be documented in OpenAPI under the **Accounts** tag with `bearerAuth` security.

10. **FR-10:** Automated tests shall verify: (a) authenticated owner receives their account via `/me`; (b) unauthenticated request returns `401`; (c) response matches `GET /v1/accounts/:id` for the same token.

## Technical Constraints

- Scope: backend only (`src/`), no frontend changes in this feature.
- No new tables or migrations required.
- Must reuse existing account read query and domain policies — no duplicated read logic in the HTTP layer beyond resolving `sub` → account id.
- Must preserve the existing API contract on all current `/v1/accounts/*` routes.
- JWT payload shape (`sub`, `role`, `profileId`) is unchanged; this feature does not add `profileId` to the account response.
- Details of route registration order, handler wiring, and test layout belong in the Tech Spec.

## Out of Scope

- Aggregated session endpoint (e.g. `GET /v1/me` returning account + seller profile + wallet status) — deferred to a future PRD if needed.
- Aliases for `PATCH /v1/accounts/me` or `DELETE /v1/accounts/me`.
- Including `profileId` in the account read response (remains JWT-only; clients may decode the token or call profile-specific routes such as `GET /v1/sellers/:id`).
- Account listing, search, or admin bulk operations.
- Changes to login, refresh, logout, or register flows.
- Frontend auth service or session storage changes (consumer teams integrate independently).
- Renaming `/v1/accounts/*` to `/v1/users/*`.

## Open Questions

- **OQ-1:** Should `API.md` be updated in the same feature or as a follow-up doc task? — **Owner:** backend maintainer (recommend yes, same PR).
- **OQ-2:** Should `.cursor/rules/module-account.mdc` add `/me` to the planned routes table? — **Owner:** backend maintainer (recommend yes, low effort).

## Decisions

| # | Question | Decision |
|---|----------|----------|
| D-1 | Path: `/v1/accounts/me` vs `/v1/users/me` vs `/v1/me`? | **`GET /v1/accounts/me`** — stays within the account resource namespace; thin alias only. |
| D-2 | New response shape vs reuse `AccountPublicView`? | **Reuse existing public view** — no new DTO. |
| D-3 | Include `profileId` in response? | **No** — remains in JWT; profile data belongs in seller/risk/admin modules. |
