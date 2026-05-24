# Task 3.0: Apply guard to `sellers.ts` routes

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Update two routes in `src/routes/v1/sellers.ts` — `PATCH /v1/sellers/:id/status` and `DELETE /v1/sellers/:id` — to use `preHandler: requireRoles("admin")` instead of an inline `if (!request.auth)` check. Because the guard guarantees `request.auth` is non-null and the role is confirmed, the inline auth check is removed from both handler bodies and `request.auth` references become non-null assertions (`request.auth!`). Integration tests are updated or added to cover the new guard behaviour on these routes.

Depends on: _Task 2.0_

## Requirements

- FR-6: Handlers must not repeat the role check the guard already performs.
- FR-7: Routes with ownership/resource-based logic (`GET /sellers`, `GET /sellers/:id`, `PATCH /sellers/:id`, `POST /sellers/:id/submit`) must not be changed.
- Techspec Component 3: `preHandler: requireRoles("admin")` must appear on the route registration for both routes.

## Subtasks

- [ ] 3.1 Read `src/routes/v1/sellers.ts` to understand the current inline checks and handler structure
- [ ] 3.2 Import `requireRoles` from `../../plugins/require-roles.js` at the top of the file
- [ ] 3.3 Add `preHandler: requireRoles("admin")` to `PATCH /v1/sellers/:id/status` route registration and remove the inline `if (!request.auth)` check from its handler
- [ ] 3.4 Add `preHandler: requireRoles("admin")` to `DELETE /v1/sellers/:id` route registration and remove the inline auth check from its handler
- [ ] 3.5 Update `request.auth` references in both handlers to `request.auth!` (non-null assertion)
- [ ] 3.6 Update or add integration tests for the `sellers.ts` guard scenarios from the techspec
- [ ] 3.7 Run `npm run lint` and verify no TypeScript errors

## Implementation details

See **Techspec § Component 3 — Route updates `sellers.ts`**.

Route registration pattern:
```typescript
api.patch("/v1/sellers/:id/status", {
  preHandler: requireRoles("admin"),
  schema: { ... },
}, async (request, reply) => {
  try {
    await executeTransitionSellerStatus(deps, {
      sellerId: request.params.id,
      targetStatus: request.body.status,
      actor: { role: request.auth!.role },
    });
    ...
  }
});
```

Integration test scenarios (from **Techspec § Test strategy — Integration sellers.ts**):

| Scenario | Expected |
|----------|----------|
| `PATCH /sellers/:id/status` with seller token | `403` |
| `PATCH /sellers/:id/status` with admin token | `204` (assuming valid transition) |
| `DELETE /sellers/:id` with seller token | `403` |
| `DELETE /sellers/:id` with admin token | `204` |
| `PATCH /sellers/:id/status` with no token | `401` (from `requireJwt`) |

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] `PATCH /v1/sellers/:id/status` returns `403` for seller token, `204` for admin token
- [ ] `DELETE /v1/sellers/:id` returns `403` for seller token, `204` for admin token
- [ ] No inline `if (!request.auth)` check remains in either guarded handler
- [ ] Routes `GET /sellers`, `GET /sellers/:id`, `PATCH /sellers/:id`, `POST /sellers/:id/submit` are untouched
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-roles-guard/prd.md` ← read first
- `tasks/prd-roles-guard/techspec.md` ← read first
- `src/routes/v1/sellers.ts` ← modify
- `src/plugins/require-roles.ts` ← read only (created in Task 2)
- `tests/routes/v1/sellers.test.ts` ← create or modify
