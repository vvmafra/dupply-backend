# Tech Spec — HTTP Roles Guard

## Overview

Implement `requireRoles`, a Fastify `preHandler` factory that enforces coarse-grained RBAC at the HTTP boundary. The guard is placed in `src/plugins/require-roles.ts`, alongside `requireJwt` and `requireDupplyApiKey`.

Adoption covers every existing route whose access control is a pure role allow-list: `PATCH /v1/sellers/:id/status`, `DELETE /v1/sellers/:id`, `POST /v1/receivables`, `POST /v1/receivables/:id/risk-decision`, and `POST /v1/receivables/:id/confirm`. Routes with ownership/resource-based logic (`GET /sellers/:id`, `PATCH /sellers/:id`, `GET /receivables`, etc.) are **not** changed.

As a consequence of the guard being the single enforcement point for coarse role checks (OQ-2 decision), the redundant `assertCanTransitionSellerStatus` and `assertCanSoftDeleteSeller` functions are removed from the domain and from the application commands that call them.

`AccountRole` in `domain/account/types.ts` is expanded to include all five v1 platform roles (`payer`, `risk_analyst_agent` added), eliminating the divergence with `PlatformRole` in `domain/receivable/transitions.ts`.

`routes-swagger.mdc` and `architecture-layers.mdc` are updated to document the new pattern.

---

## Architecture overview

```
HTTP layer (plugins/, routes/)
  └── requireJwt          → sets request.auth or returns 401
  └── requireRoles(...)   → checks request.auth.role or returns 403
  └── route handler       → request.auth is guaranteed non-null + correct role
        └── application/  → domain policies for ownership/resource checks
              └── domain/ → invariants, state machines (no role checks for
                            routes already guarded at HTTP layer)
```

---

## Component design

### 1. Expand `AccountRole` — `src/domain/account/types.ts`

The current list omits `payer` and `risk_analyst_agent`, which already exist as `PlatformRole` in `domain/receivable/transitions.ts`. Expanding `AccountRole` makes it the single source of truth for all platform roles and allows `requireRoles` to accept any valid role without a secondary type.

**File:** `src/domain/account/types.ts`

```typescript
// Before
export const ACCOUNT_ROLES = ["seller", "risk_analyst", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

// After
export const ACCOUNT_ROLES = [
  "seller",
  "payer",
  "risk_analyst",
  "risk_analyst_agent",
  "admin",
] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
```

`PlatformRole` in `domain/receivable/transitions.ts` remains unchanged; both types now cover the same set of values and are structurally compatible. No merge of the two files is done in this spec (addressed separately if needed).

Addresses: **FR-5**.

---

### 2. Guard factory — `src/plugins/require-roles.ts`

**File:** `src/plugins/require-roles.ts` *(new)*

```typescript
import type { FastifyReply, FastifyRequest } from "fastify";

import type { AccountRole } from "../domain/account/types.js";

export function requireRoles(...allowed: AccountRole[]) {
  return async function requireRolesHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.auth) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (!allowed.includes(request.auth.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
}
```

Key decisions:
- **Variadic `AccountRole[]`** — TypeScript enforces only valid roles at the call site; no runtime validation of the allow-list itself needed (FR-5).
- **401 fallback** — defensive; `requireJwt` should have already rejected the request, but the guard is safe to use standalone in tests (FR-2).
- **No `done` callback** — Fastify 5 async preHandlers resolve via `return`/`Promise` (FR-4).
- File lives in `src/plugins/` alongside `requireJwt` (FR-8).

Addresses: **FR-1, FR-2, FR-3, FR-4, FR-5, FR-8**.

---

### 3. Route updates — `src/routes/v1/sellers.ts`

Two routes get the guard. After the guard runs, `request.auth` is non-null and `role` is confirmed, so:
- The `if (!request.auth)` inline check is **removed** from those handlers.
- The `actor` object is still passed to the application layer so domain policies can handle ownership/state checks unrelated to role.

**`PATCH /v1/sellers/:id/status`** — restricted to `admin`:

```typescript
// Before
async (request, reply) => {
  if (!request.auth) return reply.code(401).send({ error: "unauthorized" });
  try {
    await executeTransitionSellerStatus(deps, {
      sellerId: request.params.id,
      targetStatus: request.body.status,
      actor: { role: request.auth.role },
    });
    ...
  }
}

// After (with preHandler: requireRoles("admin") declared on the route)
async (request, reply) => {
  try {
    await executeTransitionSellerStatus(deps, {
      sellerId: request.params.id,
      targetStatus: request.body.status,
      actor: { role: request.auth!.role },
    });
    ...
  }
}
```

**`DELETE /v1/sellers/:id`** — restricted to `admin`:

```typescript
// After (with preHandler: requireRoles("admin"))
async (request, reply) => {
  try {
    await executeSoftDeleteSeller(deps, { role: request.auth!.role }, request.params.id);
    ...
  }
}
```

Route registration for both:
```typescript
api.patch("/v1/sellers/:id/status", {
  preHandler: requireRoles("admin"),
  schema: { ... },
}, async (request, reply) => { ... });
```

Routes **not changed**: `GET /v1/sellers`, `GET /v1/sellers/:id`, `PATCH /v1/sellers/:id`, `POST /v1/sellers/:id/submit` — access control is ownership/resource-based and handled exclusively by domain policies.

Addresses: **FR-6, FR-7**.

---

### 4. Route updates — `src/routes/v1/receivables.ts`

Three routes get the guard. Inline role checks inside the handler bodies are removed.

| Route | Guard |
|-------|-------|
| `POST /v1/receivables` | `requireRoles("seller")` |
| `POST /v1/receivables/:id/risk-decision` | `requireRoles("risk_analyst", "risk_analyst_agent")` |
| `POST /v1/receivables/:id/confirm` | `requireRoles("payer")` |

**`POST /v1/receivables`**:

```typescript
// Before
if (auth.role !== PLATFORM_ROLES.SELLER) {
  return reply.code(403).send({ error: "forbidden" });
}

// After — removed; guard handles it
// handler starts directly with executeCreateReceivable(...)
```

**`POST /v1/receivables/:id/risk-decision`**:

```typescript
// Before
const role = platformRole(request.auth);
if (role !== PLATFORM_ROLES.RISK_ANALYST && role !== PLATFORM_ROLES.RISK_ANALYST_AGENT) {
  return reply.code(403).send({ error: "forbidden" });
}

// After — removed; guard handles it
// platformRole() call kept only to extract typed role for executeRiskDecision input
```

**`POST /v1/receivables/:id/confirm`**:

```typescript
// Before
if (platformRole(auth) !== PLATFORM_ROLES.PAYER) {
  return reply.code(403).send({ error: "forbidden" });
}

// After — removed; guard handles it
```

Routes **not changed**: `GET /v1/receivables`, `GET /v1/receivables/:id` — access is multi-role with ownership checks (`canViewReceivable`) that cannot be expressed as a simple allow-list.

Addresses: **FR-3, FR-6, FR-7**.

---

### 5. Remove redundant domain policies — `src/domain/seller/policies.ts`

After the guard enforces `admin` at the HTTP edge for seller status and delete routes, `assertCanTransitionSellerStatus` and `assertCanSoftDeleteSeller` are redundant. They are removed from the domain (OQ-2 decision: guard is single enforcement point).

**File:** `src/domain/seller/policies.ts`

```typescript
// Remove these two functions entirely:
// export function assertCanTransitionSellerStatus(actor: { role: AccountRole }): void { ... }
// export function assertCanSoftDeleteSeller(actor: { role: AccountRole }): void { ... }
```

The remaining `assert*` functions (`assertCanReadSeller`, `assertCanUpdateSellerMetadata`, `assertCanSubmitForReview`, `assertSellerCanCreateReceivable`) are ownership/resource-based and are **not** changed.

Addresses: **FR-6** (no duplication between guard and domain for guarded routes).

---

### 6. Remove calls in application commands

**File:** `src/application/seller/commands/transitionSellerStatusCommand.ts`

```typescript
// Remove:
import { assertCanTransitionSellerStatus } from "../../../domain/seller/policies.js";

// Remove from executeTransitionSellerStatus body:
assertCanTransitionSellerStatus(input.actor);
```

The `actor.role` field on `TransitionSellerStatusInput` remains because `assertSellerStatusTransition` (state machine) still needs it to determine the actor kind (`reviewer` vs `admin`). The type is unchanged.

**File:** `src/application/seller/commands/softDeleteSellerCommand.ts`

```typescript
// Remove:
import { assertCanSoftDeleteSeller } from "../../../domain/seller/policies.js";

// Remove from executeSoftDeleteSeller body:
assertCanSoftDeleteSeller(actor);
```

The `actor` parameter is no longer needed after this removal. The function signature can be simplified to remove it if no other caller uses it:

```typescript
// Before
export async function executeSoftDeleteSeller(
  deps: AppDeps,
  actor: { role: AccountRole },
  sellerId: string,
): Promise<void>

// After
export async function executeSoftDeleteSeller(
  deps: AppDeps,
  sellerId: string,
): Promise<void>
```

Update the call site in `sellers.ts` accordingly.

Addresses: **FR-6**.

---

### 7. Rule updates — `.cursor/rules/routes-swagger.mdc`

Add the `requireRoles` pattern to the rule file so it becomes documented convention for all future routes.

Changes:
1. **Template section** — add `preHandler` example alongside the existing `if (!request.auth)` pattern.
2. **Regras obrigatórias** — replace rule 5 ("Auth inline") with a split rule covering both cases:
   - Unguarded routes (ownership-based): keep `if (!request.auth) return reply.code(401)...`.
   - Role-restricted routes: use `preHandler: requireRoles(...)` instead; do not repeat `if (!request.auth)` in the handler body.
3. **Add new section "Role restriction"** with the allow-list table:

| Route restriction type | Mechanism |
|------------------------|-----------|
| Single or multiple roles (no ownership logic) | `preHandler: requireRoles("role1", "role2")` |
| Ownership or resource-based (role + identity check) | Inline `if (!request.auth)` + delegate to domain policy |

Addresses: **OQ-3 / FR-6**.

---

### 8. Rule updates — `.cursor/rules/architecture-layers.mdc`

In the HTTP layer row of the layer table, note that `requireRoles` is the standard mechanism for role guards, consistent with `requireJwt`.

Add to the **Handler template** section:

> **Role guards:** use `preHandler: requireRoles(...)` (from `src/plugins/require-roles.ts`) for routes restricted to specific roles. Domain policies handle ownership and resource-level checks after the guard passes.

---

## Data flow

### Guarded route (e.g. `POST /v1/receivables`)

```
HTTP request
  → requireJwt (scope preHandler)  → 401 if no/invalid token
  → requireRoles("seller")         → 403 if role ≠ seller
  → Zod body validation            → 400 if schema invalid
  → handler: executeCreateReceivable(deps, { sellerUserId, ... })
      → domain: assertSellerCanCreateReceivable(seller) → 403 if seller not active
      → db write
  → 201 { id }
```

### Unguarded route (e.g. `GET /v1/receivables/:id`)

```
HTTP request
  → requireJwt (scope preHandler)  → 401 if no/invalid token
  → Zod params validation
  → handler: inline if (!request.auth) → 401
  → db read
  → canViewReceivable(auth, row)   → 403 if not owner/staff
  → 200 { receivable }
```

---

## Files changed

| File | Change type |
|------|-------------|
| `src/domain/account/types.ts` | Modified — add `payer`, `risk_analyst_agent` to `ACCOUNT_ROLES` |
| `src/plugins/require-roles.ts` | Added — guard factory |
| `src/routes/v1/sellers.ts` | Modified — add `preHandler: requireRoles` to 2 routes; remove inline auth checks on those routes |
| `src/routes/v1/receivables.ts` | Modified — add `preHandler: requireRoles` to 3 routes; remove inline role checks |
| `src/domain/seller/policies.ts` | Modified — remove `assertCanTransitionSellerStatus`, `assertCanSoftDeleteSeller` |
| `src/application/seller/commands/transitionSellerStatusCommand.ts` | Modified — remove `assertCanTransitionSellerStatus` call and import |
| `src/application/seller/commands/softDeleteSellerCommand.ts` | Modified — remove `assertCanSoftDeleteSeller` call, import, and `actor` parameter |
| `.cursor/rules/routes-swagger.mdc` | Modified — document `requireRoles` pattern and split auth rules |
| `.cursor/rules/architecture-layers.mdc` | Modified — reference `requireRoles` in handler template section |

---

## Impact analysis

- **API compatibility:** fully non-breaking. HTTP responses for unauthorized requests remain `401` / `403`; no status code changes.
- **Database:** no migrations required.
- **Performance:** negligible — the guard is a synchronous `Array.includes` check on a tiny constant array.
- **Other modules:** `AccountRole` expansion may surface TypeScript errors in exhaustive switches elsewhere (e.g. any `switch (role)` over `AccountRole`). These must be found by `tsc` after the type change and fixed before merging.
- **Tests:** existing tests that assert `403` for wrong-role requests remain valid. Tests that construct `executeTransitionSellerStatus` or `executeSoftDeleteSeller` with an `actor` argument must be updated.

---

## Test strategy

### Unit — `requireRoles`

| Scenario | Input | Expected |
|----------|-------|----------|
| Missing auth | `request.auth = undefined`, `requireRoles("admin")` | `reply.code(401).send({ error: "unauthorized" })` |
| Wrong role | `request.auth.role = "seller"`, `requireRoles("admin")` | `reply.code(403).send({ error: "forbidden" })` |
| Matching single role | `request.auth.role = "admin"`, `requireRoles("admin")` | resolves without calling `reply` |
| Matching one of multiple roles | `request.auth.role = "risk_analyst"`, `requireRoles("risk_analyst", "risk_analyst_agent")` | resolves without calling `reply` |
| No roles in allow-list | `request.auth.role = "admin"`, `requireRoles()` | `reply.code(403).send({ error: "forbidden" })` |

### Integration — `sellers.ts` routes

| Scenario | Expected |
|----------|----------|
| `PATCH /sellers/:id/status` with seller token | `403` |
| `PATCH /sellers/:id/status` with admin token | `204` (assuming valid transition) |
| `DELETE /sellers/:id` with seller token | `403` |
| `DELETE /sellers/:id` with admin token | `204` |
| `PATCH /sellers/:id/status` with no token | `401` (from `requireJwt`) |

### Integration — `receivables.ts` routes

| Scenario | Expected |
|----------|----------|
| `POST /receivables` with admin token | `403` |
| `POST /receivables` with seller token | `201` (or `4xx` from domain) |
| `POST /receivables/:id/risk-decision` with seller token | `403` |
| `POST /receivables/:id/risk-decision` with risk_analyst token | `200` or `409` |
| `POST /receivables/:id/confirm` with seller token | `403` |
| `POST /receivables/:id/confirm` with payer token | `200` or `409` |

---

## Observability

- No new application logs needed; `403` responses from the guard are visible in Fastify's request log at the `warn` or `info` level via the existing logger configuration.
- Error body `{ error: "forbidden" }` is consistent with the existing convention used throughout `sellers.ts` and `receivables.ts`.

---

## Open questions resolved

| Question (from PRD) | Decision |
|---------------------|----------|
| OQ-1: Should `payer` and `risk_analyst_agent` be added to `AccountRole`? | **Yes.** `ACCOUNT_ROLES` in `domain/account/types.ts` is expanded to the full v1 role list. `PlatformRole` in `domain/receivable/transitions.ts` remains as-is (structurally equivalent). |
| OQ-2: Guard as single enforcement point or redundant domain check? | **Simplified.** `assertCanTransitionSellerStatus` and `assertCanSoftDeleteSeller` are removed. The guard is the single enforcement point for coarse role checks on guarded routes. |
| OQ-3: Update `routes-swagger.mdc`? | **Yes**, and also `architecture-layers.mdc`. Both files document `requireRoles` as the standard mechanism for role-restricted routes. |
