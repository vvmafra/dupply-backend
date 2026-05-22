# dupply-backend

Dupply backend: **Soroban trade-bill registry** (`TradeBillRegistry`), **HTTP API v1** (`src/`), and **indexer** (documented only — not implemented). Layout: **one Node app at repo root** + **`soroban/`** Rust workspace.

## Repository layout

| Path | Role |
|------|------|
| [`src/`](src/) | Fastify API: platform auth + receivables, Etherfuse ramp, trade-bill flow, Drizzle + SQLite (dev). |
| [`soroban/`](soroban/) | Rust workspace; contract crate in [`soroban/crates/duplicata-registry/`](soroban/crates/duplicata-registry/). |
| [`indexer/README.md`](indexer/README.md) | Placeholder doc for a future indexer (no runnable package). |
| [`docs/`](docs/) | Architecture rules, research, plans. |
| [`docker/`](docker/) | Optional local PostgreSQL compose. |
| [`API.md`](API.md) | HTTP routes, env, smoke checklist, Wasm binding regeneration. |

```text
dupply-backend/
  package.json
  src/                 # Fastify + application + domain + integrations
  drizzle/             # SQL migrations (Drizzle)
  scripts/             # etherfuse-smoke.ts, seed-platform-dev.ts
  soroban/
    Cargo.toml
    crates/duplicata-registry/
```

The **frontend** (`dupply-frontend`) lives in a separate repository.

---

## Quick start (HTTP API)

```bash
npm install
cp .env.example .env   # edit DUPPLY_API_KEY, JWT_SECRET (min 16 chars), optional ETHERFUSE_*, registry, RPC
npm run dev
```

**Render / produção:** variáveis no painel do serviço (não há `.env` no deploy). Build: `npm install && npm run build`. Start: `npm start` → `node dist/server.js`. Ver [docs/notes/2026-05-22_render-deploy.md](docs/notes/2026-05-22_render-deploy.md).

Full service documentation: **[API.md](API.md)**.

HTTP endpoints (prefix = server root, e.g. `http://localhost:8080`):

| Method | Path | Authentication | Description |
|--------|------|----------------|-------------|
| GET | `/health` | — | Liveness. |
| POST | `/v1/auth/login` | — | Human login → JWT (`JWT_SECRET` required). |
| POST | `/v1/auth/service-login` | — | Service principal login (`email` + `apiKey`). |
| GET | `/v1/receivables` | `Authorization: Bearer` | List receivables (role-scoped). |
| GET | `/v1/receivables/:id` | Bearer | Receivable detail. |
| POST | `/v1/receivables` | Bearer | Seller creates receivable (`under_review`). |
| POST | `/v1/receivables/:id/risk-decision` | Bearer | Risk offer/reject. |
| POST | `/v1/receivables/:id/confirm` | Bearer | Payer confirms. |
| POST | `/v1/internal/receivables/:id/advance-settlement` | `X-Dupply-Api-Key` | System: `processing` / `completed` (worker placeholder). |
| GET | `/v1/ramp/assets` | Header `X-Dupply-Api-Key` | Resolves ramp assets (`blockchain`, `currency`, `wallet`). Requires `ETHERFUSE_API_KEY`. |
| POST | `/v1/ramp/quotes` | Header `X-Dupply-Api-Key` | Creates Etherfuse quote; persists `ramp_quotes`. |
| POST | `/v1/ramp/orders` | `X-Dupply-Api-Key` | Creates order from a quote; persists `ramp_orders`. |
| GET | `/v1/ramp/orders/:id` | `X-Dupply-Api-Key` | Order state from DB. |
| POST | `/v1/trade-bills` | `X-Dupply-Api-Key` | Simulates `issue`, stores draft, returns `unsignedTransactionXdr`. |
| POST | `/v1/trade-bills/:id/confirm` | `X-Dupply-Api-Key` | Body `{ "txHash": "..." }`; confirms on RPC. |
| GET | `/v1/trade-bills/:id` | `X-Dupply-Api-Key` | Draft + chain record. |
| GET | `/v1/trade-bills/on-chain/:chainId` | `X-Dupply-Api-Key` | `get_trade_bill` read; `?issuer=G...`. |
| POST | `/v1/webhooks/etherfuse` | `X-Signature` (HMAC) | Etherfuse webhook. |

---

## Soroban contract (`duplicata-registry` crate, `TradeBillRegistry` type)

```bash
cd soroban
cargo test -p duplicata-registry
stellar contract build
```

- **Rust:** [soroban/rust-toolchain.toml](soroban/rust-toolchain.toml) pins **1.92.0** and `wasm32v1-none`.
- **Wasm:** `soroban/target/wasm32v1-none/release/duplicata_registry.wasm`
- **Deploy (optional):** [soroban/scripts/deploy-testnet.sh](soroban/scripts/deploy-testnet.sh), [soroban/DEPLOYMENT-testnet.md](soroban/DEPLOYMENT-testnet.md).

---

## Indexer

Not shipped as code. See **[indexer/README.md](indexer/README.md)** for intent and pointers.

---

## Database: SQLite, Docker Postgres, or Supabase

- **Default dev:** SQLite (`DATABASE_URL=file:./data/dupply.db`).
- **Supabase (recommended for shared dev / frontend data):** set `DATABASE_URL` to the Supabase Postgres URI, then `npm run db:push` and `npm run seed:platform:dev`. Step-by-step: [`docs/notes/2026-05-20_supabase-setup.md`](docs/notes/2026-05-20_supabase-setup.md).
- **Local Docker Postgres:** [docker/README.md](docker/README.md).

---

## Documentation (research and plans)

- [docs/ARCHITECTURE-RULES.md](docs/ARCHITECTURE-RULES.md) — layering, CQRS, dependency rules.  
- [docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md](docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md) — DDD/CQRS migration phases.  
- [DECISIONS.md](DECISIONS.md) — architecture decision log.  
- [docs/research/](docs/research/) and [docs/notes/](docs/notes/) — Stellar, Etherfuse, v1 plans.
