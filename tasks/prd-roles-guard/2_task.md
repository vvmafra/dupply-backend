# Task 2.0: Implement `requireRoles` guard factory with unit tests

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Create `src/plugins/require-roles.ts` — a new Fastify `preHandler` factory that enforces coarse-grained RBAC at the HTTP boundary. The factory is the central deliverable of the entire feature: all route adoption tasks (3 and 4) depend on this file existing and being correctly typed. Unit tests cover all scenarios from the test strategy section of the techspec.

Depends on: _Task 1.0_

## Requirements

- FR-1: Implement as `requireRoles(...roles: AccountRole[])` returning a Fastify `preHandler`.
- FR-2: If `request.auth` is absent, respond `401 { error: "unauthorized" }`.
- FR-3: If `request.auth.role` is not in the allow-list, respond `403 { error: "forbidden" }`.
- FR-4: If the role is in the allow-list, return without modifying the request (async, no `done` callback).
- FR-5: Accept `AccountRole` values only; expanding the type in Task 1 automatically extends what the guard accepts.
- FR-8: File must live in `src/plugins/` alongside `requireJwt`.

## Subtasks

- [ ] 2.1 Read `src/plugins/requireJwt.ts` (or equivalent) to understand the existing plugin convention and import style
- [ ] 2.2 Create `src/plugins/require-roles.ts` with the `requireRoles` factory
- [ ] 2.3 Write unit tests in `tests/plugins/require-roles.test.ts` covering all five scenarios from the techspec test strategy
- [ ] 2.4 Run `npm run lint` and verify no TypeScript errors

## Implementation details

See **Techspec § Component 2 — Guard factory**.

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

Unit test scenarios (from **Techspec § Test strategy — Unit**):

| Scenario | Input | Expected |
|----------|-------|----------|
| Missing auth | `request.auth = undefined`, `requireRoles("admin")` | `reply.code(401).send({ error: "unauthorized" })` |
| Wrong role | `request.auth.role = "seller"`, `requireRoles("admin")` | `reply.code(403).send({ error: "forbidden" })` |
| Matching single role | `request.auth.role = "admin"`, `requireRoles("admin")` | resolves without calling `reply` |
| Matching one of multiple roles | `request.auth.role = "risk_analyst"`, `requireRoles("risk_analyst", "risk_analyst_agent")` | resolves without calling `reply` |
| Empty allow-list | `request.auth.role = "admin"`, `requireRoles()` | `reply.code(403).send({ error: "forbidden" })` |

Mirror the test file path under `tests/` — never put tests inside `src/`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] All five unit test scenarios are covered
- [ ] `requireRoles` is exported from `src/plugins/require-roles.ts`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-roles-guard/prd.md` ← read first
- `tasks/prd-roles-guard/techspec.md` ← read first
- `src/plugins/require-roles.ts` ← create
- `tests/plugins/require-roles.test.ts` ← create
- `src/domain/account/types.ts` ← read only (AccountRole source)
