# Product Requirements Document — Refresh Token HttpOnly Cookie

**Status:** Implemented (backend)

## Overview

Currently, the auth flow returns the `refreshToken` in the JSON response body of `/v1/auth/login` and `/v1/auth/register`, and expects it back in the JSON request body of `/v1/auth/refresh`. This means the frontend must read, store, and resend the refresh token — making it readable by JavaScript and vulnerable to XSS attacks.

This feature migrates the refresh token transport to an `HttpOnly; Secure; SameSite=Lax` cookie managed entirely by the browser and the backend. The frontend will never read or send the refresh token explicitly; the browser will attach the cookie automatically on requests to `/v1/auth/refresh`. The access token continues to be returned in the response body and stored in memory on the client.

## Goals

- Remove the refresh token from the JSON response body of login and register endpoints.
- Remove the refresh token from the JSON request body of the refresh endpoint.
- Deliver and rotate the refresh token exclusively via an `HttpOnly` cookie.
- Enable the browser to send credentials (cookies) on cross-origin requests to auth endpoints.
- Make logout work without requiring a valid access token (fix the current blocker where an expired token prevents logout).

**Success metrics:**
- `refreshToken` field is absent from all JSON responses and request schemas.
- The cookie `dupply_rt` is present after login with `HttpOnly`, `Secure`, and `SameSite=Lax` attributes.
- `/v1/auth/refresh` rejects requests without the cookie with `401`.
- `/v1/auth/logout` clears the cookie regardless of whether the access token is valid.
- The frontend can complete the full auth cycle (login → refresh → logout) without reading the refresh token in JavaScript.

## User Stories

- As a logged-in seller, I want my session to persist after a page reload so that I do not have to log in again on every visit.
- As a user, I want the backend to handle my refresh token securely so that a JavaScript XSS attack cannot steal it.
- As a user, I want to be able to log out even when my access token has expired so that I can always end my session.

**Main flow:**
1. User logs in via `POST /v1/auth/login`. Backend returns `accessToken` in the body and sets `dupply_rt` as an `HttpOnly` cookie.
2. Frontend stores `accessToken` in memory. Browser stores `dupply_rt` automatically.
3. When `accessToken` expires, frontend calls `POST /v1/auth/refresh` with `credentials: include`. Backend reads the cookie, validates the refresh token, rotates it, sets a new `dupply_rt` cookie, and returns a new `accessToken` in the body.
4. On logout, frontend calls `POST /v1/auth/logout`. Backend reads the `dupply_rt` cookie to identify the session, invalidates the token server-side, and clears the cookie.

## Core Features

1. **Cookie-based refresh token delivery**
   - What it does: login and register set an `HttpOnly; Secure; SameSite=Lax` cookie named `dupply_rt` scoped to `Path=/v1/auth` instead of returning `refreshToken` in the JSON body.
   - Why it matters: `HttpOnly` cookies are inaccessible to JavaScript, eliminating the XSS attack surface for the refresh token.

2. **Cookie-based refresh token consumption**
   - What it does: `/v1/auth/refresh` reads the refresh token from the `dupply_rt` cookie instead of the request body. The response body is unchanged (returns new `accessToken`). The new refresh token is set in a new cookie.
   - Why it matters: the browser attaches the cookie automatically; the frontend never touches the token value.

3. **Cookie-aware logout**
   - What it does: `/v1/auth/logout` drops the `requireJwt` preHandler, reads the session identity from the `dupply_rt` cookie, invalidates the token server-side, and clears the cookie.
   - Why it matters: logout currently fails when the access token is already expired. With cookie-based identification, logout works at any time.

4. **CORS credentials support**
   - What it does: the CORS plugin is updated to set `credentials: true`, allowing the browser to send the `dupply_rt` cookie on cross-origin requests.
   - Why it matters: without this header, `credentials: "include"` on the frontend is silently ignored by the browser.

5. **`@fastify/cookie` plugin registration**
   - What it does: installs and registers the Fastify cookie plugin so that `request.cookies` and `reply.setCookie` / `reply.clearCookie` are available across all routes.
   - Why it matters: the server currently has no cookie-parsing capability.

## Functional Requirements

1. FR-1: `POST /v1/auth/login` and `POST /v1/auth/register` must set a `dupply_rt` cookie on a successful response. The cookie must have `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/v1/auth` attributes. The TTL must match `JWT_REFRESH_TTL_SECONDS`.
2. FR-2: `POST /v1/auth/login` and `POST /v1/auth/register` must NOT include `refreshToken` or `refreshExpiresInSeconds` in the JSON response body.
3. FR-3: `POST /v1/auth/refresh` must read the refresh token from the `dupply_rt` cookie. It must reject requests without the cookie with `401 { error: "missing_refresh_token" }`.
4. FR-4: `POST /v1/auth/refresh` must rotate the refresh token on every successful call: clear the old `dupply_rt` cookie and set a new one with updated TTL.
5. FR-5: `POST /v1/auth/refresh` must NOT accept `refreshToken` in the request body. The body schema must be removed.
6. FR-6: `POST /v1/auth/logout` must NOT require a valid `Authorization: Bearer` header. It must read the session from the `dupply_rt` cookie to identify which token to invalidate.
7. FR-7: `POST /v1/auth/logout` must clear the `dupply_rt` cookie on success, regardless of whether the token was found in the database.
8. FR-8: The `@fastify/cookie` plugin must be registered in the server before any route that reads or writes cookies.
9. FR-9: The CORS plugin must be updated to include `credentials: true` so the browser forwards cookies on cross-origin requests to the allowed origins.
10. FR-10: In non-production environments (`NODE_ENV !== "production"`), the `Secure` cookie attribute may be omitted to allow HTTP local development. The `HttpOnly` and `SameSite` attributes must always be set.

## Technical Constraints

- Scope: backend only (`src/`). No frontend changes in this PRD.
- Requires adding `@fastify/cookie` as a new dependency.
- No new database tables or migrations required. The refresh token storage schema (`refreshToken`, `refreshTokenLookup` columns on `accounts`) remains unchanged.
- `LoginResult` type in `loginCommands.ts` must be updated to remove `refreshToken` and `refreshExpiresInSeconds` — this is a breaking change to the existing JSON contract for `/v1/auth/login` and `/v1/auth/register`.
- CORS change (`credentials: true`) must be combined with explicit origin allowlist — wildcard `*` origin is incompatible with `credentials: true` and must not be used.
- Cookie `Path=/v1/auth` limits cookie scope to auth routes (`login`, `register`, `refresh`, `logout`) while allowing the browser to attach the cookie on logout.

## Cleanup included in this change

The following existing inconsistencies should be resolved as part of this work:

- **`refreshBodySchema`** in `routes/v1/auth.ts`: the entire Zod body schema for the refresh route must be removed since the token moves to the cookie.
- **`LoginResult.refreshToken` and `LoginResult.refreshExpiresInSeconds`** in `loginCommands.ts`: these fields must be removed from the type and the return value. Any consumer (register route) must be updated.
- **`requireJwt` on `/v1/auth/logout`**: the preHandler must be removed. Logout currently fails silently when the access token is expired, which is the most common real-world logout scenario.
- **CORS `credentials` missing**: `plugins/cors.ts` does not set `credentials: true`, which means `credentials: "include"` on the frontend never actually sends cookies today.
- **No `@fastify/cookie` installed**: the package is missing entirely; without it, `reply.setCookie` does not exist.

## Out of Scope

- Frontend changes (handled in frontend specs under `dupply-frontend/.specs/features/auth-login-persistence/`).
- Cookie signing or encryption (`__Secure-` prefix, HMAC-signed cookies) — the token is already hashed server-side; signing the cookie adds no meaningful security here.
- Refresh token family tracking or reuse detection (future enhancement).
- Multi-tab silent refresh coordination (frontend concern).
- BFF (Backend-for-Frontend) pattern migration.

## Open Questions

_All questions resolved._

| Question | Decision |
|---|---|
| Cookie `Path`: `/v1/auth/refresh` vs `/v1/auth` | **`Path=/v1/auth`** — minimum scope that covers both `/v1/auth/refresh` and `/v1/auth/logout`. With `Path=/v1/auth/refresh`, the browser never sends the cookie to logout and `HttpOnly` prevents manual forwarding from JavaScript. |
| `Secure` attribute in local development | **Omit `Secure` when `NODE_ENV !== "production"`** (FR-10). No local HTTPS required. |
