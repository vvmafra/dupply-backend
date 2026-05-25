# Task 7.0: Public HTTP routes — receivables.ts full rewrite

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Full rewrite of `src/routes/v1/receivables.ts` to expose all public receivable endpoints via thin handlers that delegate to application commands/queries. Remove prototype routes (`POST .../confirm`, `payerUserId` body field). Map domain errors to HTTP status codes — no inline role checks in handlers.

Corresponds to **techspec § Component 11 — Public HTTP routes**.

Depends on: **4.0**, **5.0**, **6.0**

## Requirements

- FR-1: `POST /v1/receivables` — `requireRoles("seller")`; body with `payerCnpj`; returns 201 `{ id }`
- FR-2: `PATCH /v1/receivables/:id` — only when `status = created`; incomplete/other status → 409
- FR-3: `POST /v1/receivables/:id/submit` — incomplete metadata → 400
- FR-4: `POST /v1/receivables/:id/risk-decision` — `requireRoles("risk_analyst", "risk_analyst_agent")`
- FR-5: `POST /v1/receivables/:id/seller-decision` — JWT + ownership in command
- FR-7: `GET /v1/receivables` — role-scoped list via query handler
- FR-8: `GET /v1/receivables/:id` — view ACL via domain policy; payer forbidden
- FR-10: Handlers pass `{ kind: "user", role: request.auth!.role }` to commands — no `if (role !== ...)` in handlers
- FR-13: Inactive seller on POST → 403 `{ error: "seller_not_active" }`
- FR-14: Same CNPJ seller/payer → 400 `{ error: "seller_and_payer_must_differ" }`
- Techspec: Swagger tags, summary, security per `routes-swagger.mdc`
- Techspec: remove `POST /v1/receivables/:id/confirm`
- Integration tests for v2 HTTP flows

## Subtasks

- [ ] 7.1 Read `src/routes/v1/receivables.ts` and `.cursor/rules/routes-swagger.mdc` for route patterns
- [ ] 7.2 Rewrite `POST /v1/receivables` with Zod body schema and seller role guard
- [ ] 7.3 Add `PATCH /v1/receivables/:id`, `POST .../submit`, `POST .../risk-decision`, `POST .../seller-decision`
- [ ] 7.4 Rewrite `GET /v1/receivables` and `GET /v1/receivables/:id` using query handlers
- [ ] 7.5 Implement thin error mapping table (ReceivableError, SellerError, ReceivableTransitionError → HTTP)
- [ ] 7.6 Remove prototype `POST .../confirm` route
- [ ] 7.7 Rewrite `tests/routes/v1/receivables.test.ts` for v2 flows
- [ ] 7.8 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "11. Public HTTP routes"** and **§ Error mapping table**.

Route summary:

| Route | preHandler | Response |
|-------|------------|----------|
| `POST /v1/receivables` | `requireRoles("seller")` | 201 `{ id }` |
| `PATCH /v1/receivables/:id` | JWT | 200 `{ ok: true }` |
| `POST /v1/receivables/:id/submit` | JWT | 200 `{ ok: true }` |
| `POST /v1/receivables/:id/risk-decision` | `requireRoles("risk_analyst", "risk_analyst_agent")` | 200 `{ ok: true }` |
| `POST /v1/receivables/:id/seller-decision` | JWT | 200 `{ ok: true }` |
| `GET /v1/receivables` | JWT | 200 array |
| `GET /v1/receivables/:id` | JWT | 200 row or 404 |

Error mapping (representative):

| Error | HTTP |
|-------|------|
| `SellerError NOT_ACTIVE` | 403 `{ error: "seller_not_active" }` |
| `INCOMPLETE_METADATA` | 400 |
| `METADATA_LOCKED` | 409 |
| `SELLER_PAYER_MUST_DIFFER` | 400 |
| `ReceivableTransitionError` | 409 |
| `NOT_FOUND` | 404 |
| `NOT_OWNER` / `FORBIDDEN` | 403 |

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit/integration tests pass (`npm test`)
- [ ] All routes appear in Swagger UI at `/docs` with tags, summary, and security
- [ ] `GET /v1/receivables` as seller returns only own receivables
- [ ] `POST /v1/receivables/:id/confirm` returns 404 (removed)
- [ ] Inactive seller POST → 403 `seller_not_active`
- [ ] No inline role checks in route handlers (FR-10)
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-module/prd.md` ← read first
- `tasks/prd-receivable-module/techspec.md` ← read first
- `.cursor/rules/routes-swagger.mdc` ← read
- `src/routes/v1/receivables.ts` ← rewrite
- `tests/routes/v1/receivables.test.ts` ← rewrite
