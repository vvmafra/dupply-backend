# Task 6.0: Update Cursor rules to document `requireRoles` pattern

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Update two Cursor rule files so that `requireRoles` becomes documented convention for all future routes. `routes-swagger.mdc` gets a new "Role restriction" section, an updated handler template, and a revised auth rule that distinguishes guard-protected routes from ownership-based routes. `architecture-layers.mdc` gets a brief addition to the HTTP layer row and the handler template section referencing `requireRoles`.

Depends on: _Task 2.0_

## Requirements

- OQ-3 / FR-6: `routes-swagger.mdc` must document `requireRoles` as the standard mechanism for role-restricted routes.
- Techspec Component 7: add `preHandler` example to template section; replace rule 5 ("Auth inline") with a split rule; add "Role restriction" table.
- Techspec Component 8: add `requireRoles` note to HTTP layer row and handler template in `architecture-layers.mdc`.

## Subtasks

- [ ] 6.1 Read `.cursor/rules/routes-swagger.mdc` to understand the current template and auth rule structure
- [ ] 6.2 Read `.cursor/rules/architecture-layers.mdc` to understand the current layer table and handler template
- [ ] 6.3 Update `routes-swagger.mdc`: add `preHandler: requireRoles(...)` example to the handler template
- [ ] 6.4 Update `routes-swagger.mdc`: replace rule 5 ("Auth inline") with the split rule covering guarded vs ownership-based routes
- [ ] 6.5 Update `routes-swagger.mdc`: add a "Role restriction" section with the mechanism table
- [ ] 6.6 Update `architecture-layers.mdc`: add `requireRoles` reference to the HTTP layer row and handler template section
- [ ] 6.7 Run `npm run lint` to confirm no TypeScript errors were introduced

## Implementation details

See **Techspec § Component 7 — Rule updates `routes-swagger.mdc`** and **§ Component 8 — Rule updates `architecture-layers.mdc`**.

**`routes-swagger.mdc` — split auth rule (replaces existing rule 5):**
- Unguarded routes (ownership-based): keep `if (!request.auth) return reply.code(401)...` inline in the handler.
- Role-restricted routes: use `preHandler: requireRoles(...)` on route registration; do not add `if (!request.auth)` in the handler body.

**`routes-swagger.mdc` — Role restriction table to add:**

| Route restriction type | Mechanism |
|------------------------|-----------|
| Single or multiple roles (no ownership logic) | `preHandler: requireRoles("role1", "role2")` |
| Ownership or resource-based (role + identity check) | Inline `if (!request.auth)` + delegate to domain policy |

**`architecture-layers.mdc` — handler template addition:**

> **Role guards:** use `preHandler: requireRoles(...)` (from `src/plugins/require-roles.ts`) for routes restricted to specific roles. Domain policies handle ownership and resource-level checks after the guard passes.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] `routes-swagger.mdc` contains a `requireRoles` example in the handler template section
- [ ] `routes-swagger.mdc` contains the "Role restriction" table distinguishing the two mechanisms
- [ ] `routes-swagger.mdc` rule 5 (or equivalent) reflects the split between guarded and ownership-based routes
- [ ] `architecture-layers.mdc` references `requireRoles` in the HTTP layer or handler template section
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-roles-guard/prd.md` ← read first
- `tasks/prd-roles-guard/techspec.md` ← read first
- `.cursor/rules/routes-swagger.mdc` ← modify
- `.cursor/rules/architecture-layers.mdc` ← modify
