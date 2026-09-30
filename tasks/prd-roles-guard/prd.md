# Product Requirements Document — HTTP Roles Guard

## Overview

The Dupply backend currently enforces role-based authorization in two inconsistent ways: some routes rely entirely on domain policies (e.g. `assertCanTransitionSellerStatus`, `assertCanSoftDeleteSeller`), while others duplicate inline role checks in the route handler itself (e.g. `receivables.ts` checks `auth.role !== PLATFORM_ROLES.SELLER` directly before calling the application layer). There is no single, declarative place at the HTTP boundary to state "only these roles may reach this handler."

This feature introduces a coarse-grained **HTTP roles guard** — a reusable `preHandler` factory that rejects requests whose JWT role is not in an explicit allow-list, returning a consistent `403 Forbidden` response before any application or domain logic runs. The guard complements (not replaces) existing domain policies, which continue to enforce fine-grained ownership and resource-level authorization.

## Goals

- Provide a single, declarative mechanism to restrict a route to one or more roles at the HTTP boundary.
- Eliminate duplicated role checks scattered across route handlers.
- Return consistent, predictable HTTP status codes for authentication vs authorization failures across all protected routes.
- Make the allowed roles for a route visible at a glance in the route registration code.

**Success metrics:**
- All routes with coarse role restrictions use the guard instead of inline `if (auth.role !== ...)` checks in the handler body.
- Zero new routes are added without either the guard or an explicit `security: []` declaration for public routes.
- `403` is returned for authenticated requests with the wrong role; `401` is returned only when the request has no valid JWT.

## User Stories

- As a **developer**, I want to declare allowed roles at the route level so that I can understand access control at a glance without reading application or domain code.
- As a **developer**, I want unauthorized role access to fail fast at the HTTP edge so that application and domain logic is never executed for callers that would be rejected anyway.
- As an **API consumer**, I want to receive `403 Forbidden` (not `401`) when I am authenticated but lack the required role, so that I can distinguish "not logged in" from "not allowed."

**Main flow:**
1. An authenticated request arrives; `requireJwt` runs (existing preHandler), sets `request.auth`.
2. `requireRoles(...)` runs next; it checks `request.auth.role` against the allow-list.
3. If the role is not allowed, the guard responds immediately with `403 { error: "forbidden" }`.
4. If the role is allowed, the handler executes normally and delegates to the application layer.

## Core Features

1. **`requireRoles` preHandler factory**
   - What it does: returns a Fastify `preHandler` that accepts a variadic list of `AccountRole` values and rejects requests whose `auth.role` is not in that list with `403`.
   - Why it matters: removes the need for inline role checks in handlers and provides a consistent authorization failure response.

2. **Adoption on existing coarse-grained role routes**
   - What it does: replaces existing inline role checks in `sellers.ts` and `receivables.ts` route handlers with the guard where the restriction is purely role-based (not ownership/resource-based).
   - Why it matters: reduces handler body size, removes logic duplication, and makes access control auditable.

3. **`401` / `403` split enforcement**
   - What it does: guarantees that `401` is only emitted by `requireJwt` (missing/invalid token) and `403` by `requireRoles` (wrong role) or domain policies (ownership/resource rules).
   - Why it matters: aligns with HTTP semantics and avoids confusing API consumers about the nature of the rejection.

## Functional Requirements

1. **FR-1:** The guard must be implemented as a factory function `requireRoles(...roles: AccountRole[])` that returns a Fastify-compatible `preHandler` hook.
2. **FR-2:** If `request.auth` is absent when the guard runs, it must respond `401 { error: "unauthorized" }` (defensive fallback; `requireJwt` should have run first).
3. **FR-3:** If `request.auth.role` is not included in the `roles` allow-list, the guard must respond `403 { error: "forbidden" }` and halt the request lifecycle.
4. **FR-4:** If `request.auth.role` is in the allow-list, the guard must call `done` / return without modifying the request, allowing the handler to proceed.
5. **FR-5:** The guard must accept any combination of the closed role list defined in `domain/account/types.ts` (`seller`, `risk_analyst`, `admin`); future roles added to that type must automatically be usable with the guard without changes to the guard itself.
6. **FR-6:** Routes that use the guard must not repeat the same role check inside the handler body; the handler may still delegate actor role to the application layer for fine-grained domain policies.
7. **FR-7:** Routes whose access control is purely ownership/resource-based (e.g. `GET /sellers/:id`, where both owner and admin may access) must not use the guard; they continue to rely on domain policies exclusively.
8. **FR-8:** The guard must be placed in `src/plugins/` alongside `requireJwt`, consistent with the existing HTTP-layer auth plugin convention.

## Technical Constraints

- Scope: backend only (`src/`), no frontend changes.
- No new database tables or migrations required.
- Must not break the existing API contract on any `/v1/` route.
- Must be compatible with the Fastify 5 `preHandler` hook lifecycle and the `fastify-type-provider-zod` type provider already in use.
- Implementation details (file names, exact function signatures, which specific routes are updated) are defined in the Tech Spec.

## Out of Scope

- Role management UI or admin panels.
- Dynamic roles loaded from the database (v1 uses a closed, compile-time role list).
- Middleware for `X-Dupply-Api-Key` routes (API key auth is handled separately by `requireDupplyApiKey`).
- Replacing domain-level ownership policies (`assertCanReadSeller`, `assertCanUpdateSellerMetadata`, etc.) — the guard is coarse-grained only.
- Adding new roles beyond the closed v1 list (`seller`, `risk_analyst`, `admin`, `payer`, `risk_analyst_agent`).
- Rate limiting or quota enforcement.

## Open Questions

- **OQ-1:** Should `payer` and `risk_analyst_agent` be added to `AccountRole` in `domain/account/types.ts` (currently only `seller`, `risk_analyst`, `admin` are listed there), or does the guard use a separate, broader role union? — **Owner: backend lead.**
- **OQ-2:** When a route requires "admin OR risk_analyst", should the guard be the single enforcement point, or should domain policies remain as a redundant second check? — decision affects how much the domain policies can be simplified after the guard is added. — **Owner: backend lead.**
- **OQ-3:** Should the routes-swagger rule (`routes-swagger.mdc`) be updated to make `preHandler: requireRoles(...)` a documented pattern alongside the existing `if (!request.auth)` inline check? — **Owner: backend lead.**
