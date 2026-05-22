# Supabase — connect Dupply backend + frontend

**Date:** 2026-05-20  
**Context:** Supabase project **Dupply** provisioned (empty DB). Backend supports **PostgreSQL** when `DATABASE_URL` starts with `postgresql://` or `postgres://`.

**Official references:**

- [Supabase: Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Drizzle + PostgreSQL](https://orm.drizzle.team/docs/get-started/postgresql-new)

---

## 1. Backend — create tables on Supabase

1. In Supabase Dashboard → **Project Settings** → **Database** → copy **Connection string** (URI).
   - For **`npm run db:push`**, try **Direct connection** (host `db.[ref].supabase.co`, port **5432**) first.
   - If you see **`ENETUNREACH`** with an **IPv6** address (`2600:...`), your network has no IPv6 route. The repo forces **IPv4 first** (`dns.setDefaultResultOrder('ipv4first')` + `NODE_OPTIONS=--dns-result-order=ipv4first` on npm scripts). Retry `npm run db:push`.
   - If it still fails, use **Session pooler** URI from the dashboard (port **5432**, user `postgres.[ref]`). Pooler host is often `aws-1-<region>.pooler.supabase.com` (e.g. `aws-1-us-east-2` for Ohio) — **copy the host from Connect**, do not guess `aws-0` vs `aws-1`.
   - Dupply project ref `kflhwoztjykqsbnnhxno`: working URI pattern tested: `postgresql://postgres.kflhwoztjykqsbnnhxno:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres`.
   - SSL is enabled automatically for `supabase.com` hosts in code.

2. In `dupply-backend/.env` (never commit):

```bash
# Supabase Postgres (replace [PASSWORD] and project ref)
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres

JWT_SECRET=your-secret-at-least-16-chars
DUPPLY_API_KEY=change-me
```

3. Push schema from Drizzle (recommended for **empty** Supabase):

```bash
cd dupply-backend
npm run db:push
```

Must end with **`[✓] Changes applied`** (not only “No changes detected” on an empty DB).  
Postgres uses [`src/db/schema.pg.ts`](../../src/db/schema.pg.ts) (`pgTable`); SQLite dev uses [`src/db/schema.ts`](../../src/db/schema.ts) (`sqliteTable`).

Creates: `platform_users`, `receivables`, `ramp_quotes`, `ramp_orders`, `trade_bill_drafts`, `trade_bill_chain_records`.

4. Seed dev users (optional):

```bash
set -a && source .env && set +a
npm run seed:platform:dev
```

5. Run API against Supabase:

```bash
npm run dev
```

Tables appear in **Table Editor**; Dashboard **Migrations** may still show “No migrations” if you used `db:push` (Drizzle journal is local) — that is OK for MVP.

---

## 2. Frontend — two patterns

### A. Recommended MVP: frontend → Dupply API (JWT)

- No direct DB access from the browser.
- Login: `POST /v1/auth/login` on the API; store `accessToken`; call `/v1/receivables/*` with `Authorization: Bearer`.
- Replace mocks in `dupply-frontend/src/services/*.ts` with `fetch` to `VITE_API_BASE_URL`.

```bash
# dupply-frontend/.env.local
VITE_API_BASE_URL=http://localhost:8080
```

RBAC and status transitions stay on the backend.

### B. Direct Supabase client (later)

- Dashboard → **API Keys**: `Project URL` + `anon` / `service_role`.
- Enable **Row Level Security (RLS)** on every table before exposing `anon` to the browser.
- Today Dupply auth is **our JWT**, not Supabase Auth — using `@supabase/supabase-js` for data only requires aligning RLS with `platform_users.id` or moving login to Supabase Auth.

```bash
VITE_SUPABASE_URL=https://[PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Do not** put `service_role` in the frontend.

---

## 3. Local dev vs Supabase

| `DATABASE_URL` | Engine |
|----------------|--------|
| `file:./data/dupply.db` | SQLite (default) |
| `postgresql://...supabase.com...` | Supabase Postgres |

Same `schema.ts`; switch URL only.

---

## 4. Rollback

- Drop tables in Supabase SQL Editor, or create a new Supabase project.
- Point `DATABASE_URL` back to SQLite for local-only work.
