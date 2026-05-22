# Auth + RBAC + receivable MVP — implementation log

**Date:** 2026-05-19  
**Normative product rules:** [`2026-05-19_platform-auth-rbac-receivable-v1.md`](2026-05-19_platform-auth-rbac-receivable-v1.md)

## What was added

- **Tables:** `platform_users`, `receivables` ([`src/db/schema.ts`](../../src/db/schema.ts)); migration [`0003_platform_users_receivables.sql`](../../drizzle/0003_platform_users_receivables.sql).
- **Auth:** `POST /v1/auth/login` (humans), `POST /v1/auth/service-login` (service API key in body); HS256 JWT via [`jose`](https://github.com/panva/jose); passwords / service keys hashed with **Argon2id** ([`argon2`](https://github.com/ranisalt/node-argon2)).
- **Receivables (Bearer JWT):** `GET /v1/receivables`, `GET /v1/receivables/:id`, `POST /v1/receivables`, `POST /v1/receivables/:id/risk-decision`, `POST /v1/receivables/:id/confirm`.
- **Settlement (API key only):** `POST /v1/internal/receivables/:id/advance-settlement` with `{ "targetStatus": "processing" | "completed" }` — **replace with a worker** before production hardening.

## Commands run (smoke)

```bash
mkdir -p data
DATABASE_URL=file:./data/dupply.db npm run db:migrate
DATABASE_URL=file:./data/dupply.db JWT_SECRET='dev-secret-at-least-16' npm run seed:platform:dev
# Human password from seed: dev-password-change-me
```

## Rollback

Revert migration entry + SQL file + new `src/` modules; drop tables `receivables`, `platform_users` from dev DB if needed.
