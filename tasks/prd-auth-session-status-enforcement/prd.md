# Product Requirements Document — Auth Session Status Enforcement

**Status:** Draft — complements frontend PRD `prd-seller-session-status-sync`; addresses server-side gaps in session bootstrap and lifecycle status enforcement

## Overview

Dupply authentication uses short-lived JWT access tokens and a separate seller lifecycle (`created` → `in_review` → `active` | `inactive`) stored on the `sellers` table. Account-level status (`active` | `inactive`) lives on `accounts` and is validated on login and refresh. Seller lifecycle status is **not** included in the JWT, is **not** revalidated by the JWT middleware, and is **not** returned by the existing `GET /v1/accounts/me` endpoint.

Investigation confirmed the backend does **not** cache user or seller status — each login/refresh reads fresh account data from the database. However, once a token is issued, protected routes accept it until expiry even if account or seller status has changed. Frontend clients must make separate calls (`GET /v1/accounts/me` plus `GET /v1/sellers/:id`) to bootstrap session state, and seller `inactive` users can still obtain valid tokens because login/refresh only checks account status.

This feature strengthens the auth and session contract so clients can bootstrap lifecycle status reliably and the server enforces status changes without relying solely on frontend checks. It is intentionally scoped as backend-only; the frontend PRD `prd-seller-session-status-sync` may consume new endpoints and error codes but is not required for backend delivery.

## Goals

- Provide a first-class backend read for the authenticated seller's current lifecycle status without requiring clients to assemble URLs from JWT `profileId`.
- Optionally reduce session-bootstrap round-trips with an aggregated session read (account + seller profile).
- Enforce seller `inactive` status at login and refresh so rejected sellers cannot obtain or renew access tokens.
- Revalidate account status on protected requests so inactive or soft-deleted accounts cannot keep using a previously issued JWT.
- Enforce seller lifecycle rules on seller-scoped and receivable-mutating routes so stale tokens cannot bypass operational gates.
- Preserve backward compatibility for existing clients where possible; additive changes preferred over breaking JWT or response contracts.

**Success metrics:**

- Authenticated seller clients can retrieve current seller lifecycle status via a dedicated `/me`-style route without constructing `GET /v1/sellers/:id` manually.
- Login and refresh return a stable, documented error when the linked seller is `inactive` (seller-role accounts).
- A valid JWT belonging to an account that became `inactive` or soft-deleted is rejected on protected routes.
- Seller `inactive` callers receive `403` on seller profile and receivable mutation routes even with a valid JWT.
- Existing account read (`GET /v1/accounts/me`, `GET /v1/accounts/:id`) and auth cookie behavior remain unchanged unless explicitly extended here.
- Automated route and command tests cover new enforcement paths and the new read endpoint(s).

## User Stories

- As a **frontend developer**, I want a conventional seller session read endpoint so that session restore can fetch lifecycle status in one predictable call without JWT parsing beyond authentication.
- As a **frontend developer**, I want login and refresh to fail for rejected sellers so that the client does not need to be the only enforcement layer for `inactive` sellers.
- As a **seller**, I want the platform to deny API access when my account or seller profile has been deactivated so that old browser sessions cannot perform actions after admin rejection.
- As a **platform operator**, I want status enforcement to happen server-side so that API consumers cannot bypass lifecycle gates with a stored token.
- As an **admin**, I want existing seller approval and rejection flows (`PATCH /v1/sellers/:id/status`) unchanged so that this feature only adds read and enforcement layers.

**Main flow — session bootstrap (consumer):**

1. Client holds a valid access token.
2. Client calls the new session read endpoint(s) to obtain account status and seller lifecycle status.
3. Client applies routing and UI gates based on fresh server data.
4. If account or seller is no longer eligible, subsequent protected calls also fail server-side.

**Main flow — rejected seller login:**

1. Admin sets seller status to `inactive`.
2. Seller attempts login or token refresh with valid credentials.
3. System loads linked seller profile, detects `inactive`, and returns a documented auth error without issuing a new access token.
4. Existing refresh cookie is invalidated or left unusable per existing rotation rules.

**Main flow — stale JWT after account deactivation:**

1. User holds a non-expired access token.
2. Admin deactivates the account (`status = inactive`) or soft-deletes it.
3. User calls any protected route.
4. System revalidates account status, rejects the request with `401` or `403` per documented contract, and does not execute the handler.

## Core Features

### Phase A — Session bootstrap API (recommended first delivery)

1. **GET /v1/sellers/me alias**
   - What it does: Returns the authenticated seller's public profile (including lifecycle `status`) by resolving the seller from JWT `profileId` for seller-role actors.
   - Why it matters: Mirrors the existing `GET /v1/accounts/me` pattern; removes client-side URL assembly and reduces integration errors.

2. **Optional aggregated session read — GET /v1/me**
   - What it does: Returns account public view plus role-appropriate profile summary (seller lifecycle status at minimum) in a single response for session bootstrap.
   - Why it matters: Reduces round-trips on page load; frontend PRD may adopt later without requiring two parallel fetches.

### Phase B — Auth-time seller enforcement

3. **Block seller `inactive` on login and refresh**
   - What it does: For accounts with `role = seller`, load the linked seller and reject authentication when seller status is `inactive`, using a stable machine-readable error code.
   - Why it matters: Frontend today enforces this after token issuance; server should fail closed at the auth boundary.

### Phase C — Request-time account revalidation

4. **Account status check on protected routes**
   - What it does: After JWT verification, confirm the account exists, is not soft-deleted, and has `status = active` before executing protected handlers.
   - Why it matters: JWT validity alone currently allows inactive accounts to call APIs until token expiry.

### Phase D — Request-time seller enforcement (scoped routes)

5. **Seller lifecycle guard on seller and receivable mutation routes**
   - What it does: For seller-role actors on seller-scoped and receivable-mutating endpoints, reject requests when seller status is `inactive`; apply existing domain rules for operational mutations requiring `active`.
   - Why it matters: Defense in depth — command-layer checks exist for receivable creation but are not uniform across all seller routes; inactive sellers should not read/write seller resources.

## Functional Requirements

### Phase A — Session bootstrap reads

1. **FR-1:** The system shall expose `GET /v1/sellers/me` as an authenticated route (Bearer JWT required).

2. **FR-2:** `GET /v1/sellers/me` shall resolve the target seller from JWT `profileId` when the authenticated actor's role is `seller`.

3. **FR-3:** `GET /v1/sellers/me` shall return the same response body as `GET /v1/sellers/:id` when `:id` equals JWT `profileId` for a seller actor — i.e. the existing seller public view including lifecycle `status`.

4. **FR-4:** `GET /v1/sellers/me` shall return `403` when the authenticated actor is not a seller (non-seller roles must not use this alias).

5. **FR-5:** `GET /v1/sellers/me` shall return `401` when no valid JWT is present or the token is invalid/expired.

6. **FR-6:** `GET /v1/sellers/me` shall return `404` with error code `not_found` when the seller referenced by JWT `profileId` does not exist or is soft-deleted, consistent with `GET /v1/sellers/:id`.

7. **FR-7:** The literal path segment `me` shall not be captured as a dynamic seller id on `GET /v1/sellers/:id` — route registration order must guarantee `/me` is handled by the alias route.

8. **FR-8:** (Optional — Phase A+) The system may expose `GET /v1/me` returning an aggregated session payload: account public view plus seller public view when `role = seller`. Exact response shape is defined in the Tech Spec.

9. **FR-9:** If `GET /v1/me` is implemented, it shall require Bearer JWT and shall not expose secrets (`passwordHash`, `refreshToken`).

10. **FR-10:** Existing `GET /v1/sellers/:id` behavior for admin and owner access shall remain unchanged aside from route ordering requirements in FR-7.

11. **FR-11:** New read routes shall be documented in OpenAPI and `API.md`.

### Phase B — Login and refresh enforcement

12. **FR-12:** On `POST /v1/auth/login`, when the authenticated account has `role = seller`, the system shall load the linked seller and reject the login if seller status is `inactive`.

13. **FR-13:** On `POST /v1/auth/refresh`, when the account has `role = seller`, the system shall load the linked seller and reject the refresh if seller status is `inactive`.

14. **FR-14:** Seller `inactive` rejection on login and refresh shall return HTTP `403` with a stable error code (proposed: `seller_inactive`) and a human-readable message suitable for client mapping.

15. **FR-15:** Seller `inactive` rejection shall not issue a new access token or rotate the refresh cookie to an active session.

16. **FR-16:** Login and refresh shall continue to enforce existing account rules (`deletedAt`, `status = inactive`) via `assertCanAuthenticate` without regression.

17. **FR-17:** Login and refresh behavior for non-seller roles shall remain unchanged.

### Phase C — Account revalidation on protected requests

18. **FR-18:** For all routes protected by JWT (except explicitly public auth routes), the system shall revalidate that the account identified by JWT `sub` exists, is not soft-deleted, and has `status = active`.

19. **FR-19:** When account revalidation fails, the system shall return `401` for missing/invalid token (unchanged) and `403` with error code `account_inactive` or `account_deleted` (or existing equivalent codes) when the account is inactive or soft-deleted — exact mapping defined in Tech Spec for consistency with login errors.

20. **FR-20:** Account revalidation shall occur after JWT signature/expiry verification and before route handler execution.

21. **FR-21:** Account revalidation shall not change JWT payload shape or issuance rules.

### Phase D — Seller lifecycle enforcement on scoped routes

22. **FR-22:** For seller-role actors calling seller-scoped routes (`/v1/sellers/*` except admin-only status transitions), the system shall reject requests when the linked seller status is `inactive` with HTTP `403` and error code `seller_inactive`.

23. **FR-23:** Receivable mutation routes already requiring seller `active` at the command layer shall continue to return `403 seller_not_active` for non-active sellers; this PRD does not change those semantics.

24. **FR-24:** Seller lifecycle enforcement on routes shall read fresh status from the database (no caching layer introduced).

25. **FR-25:** Admin and risk_analyst actors calling seller management routes shall not be subject to seller lifecycle guards on their own profile (guards apply to seller-role actors only).

### Cross-cutting

26. **FR-26:** All new error codes shall be documented in `API.md` and covered by automated tests.

27. **FR-27:** No new database tables or migrations are required unless the Tech Spec identifies an unavoidable need (default: reuse existing `accounts` and `sellers` tables).

28. **FR-28:** JWT claims (`sub`, `role`, `profileId`, `iat`, `exp`) shall remain unchanged; status shall not be embedded in the access token in v1 of this feature.

## Technical Constraints

- Scope: backend only (`src/`), no frontend changes in this feature.
- Must follow existing DDD/CQRS layering — business rules in domain/application; thin HTTP routes.
- Must preserve existing non-breaking contracts on `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`, and `/v1/accounts/me` unless explicitly extended.
- Route registration order for `/me` aliases is critical — must not regress dynamic `:id` routes.
- Performance: account/seller status lookups on protected routes must remain O(1) indexed reads; batching or caching strategies belong in Tech Spec if needed.
- No Redis or external cache required for v1.
- Implementation details (middleware vs hook, file layout, exact response DTOs) belong in the Tech Spec.

## Out of Scope

- Frontend session storage, React state, or polling changes (see frontend PRD `prd-seller-session-status-sync`).
- Embedding seller or account status in JWT claims or shortening access token TTL as the primary fix.
- WebSocket, SSE, or push notifications for status change events.
- Changes to admin seller approval UI or `PATCH /v1/sellers/:id/status` transition rules.
- Account reactivation API (`accounts.status` inactive → active) — no such endpoint exists today.
- Wallet status enforcement beyond existing wallet module rules.
- Risk analyst, payer, or admin persona lifecycle enforcement (only seller + account in scope).
- Renaming `/v1/accounts/*` or `/v1/sellers/*` namespaces.

## Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Deliver Phase A (`GET /v1/sellers/me`) only first, or include aggregated `GET /v1/me` in the same release? | Product / Engineering | **Open** — FR-8 |
| Exact aggregated `GET /v1/me` response shape if implemented (nested vs flat, which profile fields)? | Product / Frontend | **Open** — FR-8, FR-9 |
| On seller `inactive` login/refresh, should the refresh cookie be explicitly cleared vs left stale until natural expiry? | Engineering | **Open** — FR-15 |
| Account revalidation failure: always `403` vs `401` for inactive/deleted account with otherwise valid JWT? | Engineering | **Open** — FR-19 |
| Should seller `inactive` block **all** seller routes including read-only `GET /v1/sellers/:id`, or only mutations? | Product | **Open** — FR-22 (recommend block all seller-self routes for consistency with frontend) |
| Should Phase C (account revalidation on every protected route) ship together with Phase B or as a follow-up task? | Engineering | **Open** — performance vs security tradeoff |
| Should `GET /v1/sellers/me` be available to admin reading on behalf of a seller, or strictly seller actor only? | Product | **Open** — FR-4 assumes seller-only |
| Update `.cursor/rules/module-account.mdc` and `module-seller.mdc` planned routes tables in same PR? | Backend maintainer | **Open** — recommend yes |

## Relationship to Other Work

| Artifact | Relationship |
|----------|--------------|
| Frontend `prd-seller-session-status-sync` | Consumer of new read endpoints and error codes; fixes client-side stale state independently |
| Backend `prd-account-me-route` (shipped) | Precedent for `/me` alias pattern; this PRD extends the same pattern to sellers |
| Seller Registration Integration (frontend) | Defines lifecycle UX; backend enforcement aligns server with those rules |
| Receivable module | Already enforces `seller_not_active` on create/submit commands; Phase D harmonizes route-level guards |

## Suggested Delivery Order

1. **Phase A** — `GET /v1/sellers/me` (+ optional `GET /v1/me`) — unblocks cleaner frontend bootstrap.
2. **Phase B** — login/refresh seller `inactive` block — closes auth boundary gap.
3. **Phase C** — account revalidation middleware — closes stale JWT gap for accounts.
4. **Phase D** — seller route guards — defense in depth for seller resources.

Phases may ship as separate task groups within one techspec or as sequential PRs; Tech Spec will define the split.
