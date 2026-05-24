# Task 4.0: Apply guard to `receivables.ts` routes

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Update three routes in `src/routes/v1/receivables.ts` to replace inline role checks with `preHandler: requireRoles(...)`. Each route has a different allow-list: `POST /v1/receivables` allows only `seller`; `POST /v1/receivables/:id/risk-decision` allows `risk_analyst` and `risk_analyst_agent`; `POST /v1/receivables/:id/confirm` allows `payer`. The inline `if (auth.role !== ...)` / `platformRole(...)` checks in the handler bodies are removed. Integration tests are updated or added to cover the guard behaviour on these routes.

Depends on: _Task 2.0_

## Requirements

- FR-3: Guard must respond `403 { error: "forbidden" }` for wrong-role requests.
- FR-6: Handlers must not repeat the role check the guard already performs.
- FR-7: `GET /v1/receivables` and `GET /v1/receivables/:id` must not be changed (multi-role ownership checks).
- Techspec Component 4: apply the guard allow-lists exactly as specified.

## Subtasks

- [ ] 4.1 Read `src/routes/v1/receivables.ts` to understand the current inline role checks and `platformRole()` usage
- [ ] 4.2 Import `requireRoles` from `../../plugins/require-roles.js`
- [ ] 4.3 Add `preHandler: requireRoles("seller")` to `POST /v1/receivables` and remove the inline role check from its handler
- [ ] 4.4 Add `preHandler: requireRoles("risk_analyst", "risk_analyst_agent")` to `POST /v1/receivables/:id/risk-decision` and remove the inline role check; keep any remaining `platformRole()` call only if it is still needed to extract a typed role for `executeRiskDecision`
- [ ] 4.5 Add `preHandler: requireRoles("payer")` to `POST /v1/receivables/:id/confirm` and remove the inline role check from its handler
- [ ] 4.6 Update or add integration tests for the `receivables.ts` guard scenarios from the techspec
- [ ] 4.7 Run `npm run lint` and verify no TypeScript errors

## Implementation details

See **Techspec § Component 4 — Route updates `receivables.ts`**.

Guard allow-list per route:

| Route | Guard |
|-------|-------|
| `POST /v1/receivables` | `requireRoles("seller")` |
| `POST /v1/receivables/:id/risk-decision` | `requireRoles("risk_analyst", "risk_analyst_agent")` |
| `POST /v1/receivables/:id/confirm` | `requireRoles("payer")` |

For `POST /v1/receivables`:
```typescript
// Before
if (auth.role !== PLATFORM_ROLES.SELLER) {
  return reply.code(403).send({ error: "forbidden" });
}
// After — removed; handler starts directly with executeCreateReceivable(...)
```

For `POST /v1/receivables/:id/risk-decision`:
```typescript
// Before
const role = platformRole(request.auth);
if (role !== PLATFORM_ROLES.RISK_ANALYST && role !== PLATFORM_ROLES.RISK_ANALYST_AGENT) {
  return reply.code(403).send({ error: "forbidden" });
}
// After — inline check removed; keep platformRole() only if needed for executeRiskDecision input
```

Integration test scenarios (from **Techspec § Test strategy — Integration receivables.ts**):

| Scenario | Expected |
|----------|----------|
| `POST /receivables` with admin token | `403` |
| `POST /receivables` with seller token | `201` (or `4xx` from domain) |
| `POST /receivables/:id/risk-decision` with seller token | `403` |
| `POST /receivables/:id/risk-decision` with risk_analyst token | `200` or `409` |
| `POST /receivables/:id/confirm` with seller token | `403` |
| `POST /receivables/:id/confirm` with payer token | `200` or `409` |

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] `POST /receivables` returns `403` for admin token, `201` for seller token
- [ ] `POST /receivables/:id/risk-decision` returns `403` for seller token, `200/409` for risk_analyst token
- [ ] `POST /receivables/:id/confirm` returns `403` for seller token, `200/409` for payer token
- [ ] No inline role check remains in any of the three guarded handlers
- [ ] `GET /receivables` and `GET /receivables/:id` are untouched
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-roles-guard/prd.md` ← read first
- `tasks/prd-roles-guard/techspec.md` ← read first
- `src/routes/v1/receivables.ts` ← modify
- `src/plugins/require-roles.ts` ← read only (created in Task 2)
- `tests/routes/v1/receivables.test.ts` ← create or modify
