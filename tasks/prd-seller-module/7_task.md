# Task 7.0: HTTP routes — sellers + auth register + server wiring

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Creates the full HTTP layer for the seller module: the new `src/routes/v1/sellers.ts` file with 6 routes, updates `src/routes/v1/auth.ts` to add `POST /v1/auth/register`, registers everything in `src/server.ts`, and updates `API.md` with the new endpoints and the corrected money convention. Handlers are intentionally thin: Zod validation at the edge → application command/query → `mapSellerError`.

Corresponds to **techspec component 8**.

Depends on: _3.0, 4.0, 5.0, 6.0_

## Requirements

- `POST /v1/auth/register`: unauthenticated, accepts `{ email, password, name, role: "seller" }`, returns `201` with login-shape tokens + `sellerId`; `role` enum enforced — only `"seller"` accepted in v1 (FR-1)
- `GET /v1/sellers`: requires JWT, admin or risk_analyst only, optional `?status` filter → `200 SellerPublicView[]` (FR-16)
- `GET /v1/sellers/:id`: requires JWT, own seller or admin or risk_analyst (if `in_review`) → `200 SellerPublicView` (FR-16)
- `PATCH /v1/sellers/:id`: requires JWT, seller only (own), body = partial metadata → `200 SellerPublicView` (FR-3)
- `POST /v1/sellers/:id/submit`: requires JWT, seller only (own), no body → `204` (FR-10)
- `PATCH /v1/sellers/:id/status`: requires JWT, admin only (v1), body = `{ status: "active" | "inactive" }` → `204` (FR-11, FR-12, FR-13)
- `DELETE /v1/sellers/:id`: requires JWT, admin only → `204` (FR-15)
- `mapSellerError` converts `SellerError` codes to the correct HTTP status codes (see techspec error table)
- `API.md` updated with register endpoint, all seller endpoints, and the money convention note (API in reais)

## Subtasks

- [ ] 7.1 Read `src/routes/v1/auth.ts` and an existing route file (e.g., `src/routes/v1/receivables.ts`) to understand Zod + Fastify + `requireJwt` patterns
- [ ] 7.2 Add `POST /v1/auth/register` handler to `src/routes/v1/auth.ts` — Zod schema, call `executeRegisterSeller`, issue tokens, return `201`
- [ ] 7.3 Create `src/routes/v1/sellers.ts` with all 6 seller routes and `mapSellerError`
- [ ] 7.4 Register seller routes in `src/server.ts` behind `requireJwt` (register endpoint itself is public)
- [ ] 7.5 Update `API.md`: add register and seller endpoint tables, note money convention (reais in/out, cents in DB)
- [ ] 7.6 Write integration tests `tests/routes/v1/sellerRoutes.test.ts` covering: full happy-path register → PATCH metadata → submit → admin approve → get profile; error cases for forbidden, locked metadata, invalid transition
- [ ] 7.7 Update `tests/routes/v1/accountAuthRoutes.test.ts` for the new register endpoint
- [ ] 7.8 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "8. HTTP routes"**.

### Route table

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/v1/auth/register` | — | `{ email, password, name, role: "seller" }` | `201` tokens + `{ sellerId }` |
| GET | `/v1/sellers` | admin; risk_analyst | `?status=` | `200 SellerPublicView[]` |
| GET | `/v1/sellers/:id` | seller (own), admin, risk_analyst (if `in_review`) | — | `200 SellerPublicView` |
| PATCH | `/v1/sellers/:id` | seller (own) | partial metadata | `200 SellerPublicView` |
| POST | `/v1/sellers/:id/submit` | seller (own) | — | `204` |
| PATCH | `/v1/sellers/:id/status` | admin (v1) | `{ status: "active" \| "inactive" }` | `204` |
| DELETE | `/v1/sellers/:id` | admin | — | `204` |

### Error mapping

| SellerError code | HTTP |
|-----------------|------|
| `seller_not_found` | 404 |
| `forbidden` | 403 |
| `metadata_locked` | 409 |
| `validation_error` | 400 |
| `incomplete_metadata` | 400 |
| `invalid_status_transition` | 409 |
| `invalid_status_for_submit` | 409 |
| `seller_not_active` | 403 |

Zod schema for register — enforce `role: z.literal("seller")` to reject unsupported roles with `400 unsupported_role`.

Zod schema for metadata PATCH money fields: `shareCapital: z.number().nonnegative().multipleOf(0.01)`, `annualRevenue: z.number().nonnegative().multipleOf(0.01)`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] `POST /v1/auth/register` with valid body returns `201` with `accessToken`, `refreshToken`, and `sellerId`
- [ ] `POST /v1/auth/register` with `role: "admin"` returns `400`
- [ ] `GET /v1/sellers/:id` by own seller returns `200 SellerPublicView`
- [ ] `GET /v1/sellers/:id` by different seller returns `403`
- [ ] `PATCH /v1/sellers/:id` while `status = in_review` returns `409`
- [ ] `PATCH /v1/sellers/:id/status` by non-admin returns `403`
- [ ] `DELETE /v1/sellers/:id` by non-admin returns `403`
- [ ] `API.md` reflects all new endpoints and money convention
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-seller-module/prd.md` ← read first
- `tasks/prd-seller-module/techspec.md` ← read first
- `src/routes/v1/sellers.ts` ← create
- `src/routes/v1/auth.ts` ← modify
- `src/server.ts` ← modify
- `API.md` ← modify
- `tests/routes/v1/sellerRoutes.test.ts` ← create
- `tests/routes/v1/accountAuthRoutes.test.ts` ← modify
