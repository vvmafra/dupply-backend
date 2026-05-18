# dupply-backend

Monorepo for Dupply: **Soroban duplicata registry**, **HTTP API v1**, and **indexer** (MVP). Layout follows common **npm workspaces** + dedicated **Soroban** workspace.

## Repository layout

| Path | Role |
|------|------|
| [`packages/api/`](packages/api/) | Fastify HTTP API: Etherfuse ramp, duplicata flow (simulate → XDR → confirm `txHash`), SQLite in dev. |
| [`packages/indexer/`](packages/indexer/) | Node skeleton for events / Horizon (see package README). |
| [`soroban/`](soroban/) | Rust workspace: `duplicata-registry` Soroban contract under [`soroban/crates/duplicata-registry/`](soroban/crates/duplicata-registry/). |
| [`docs/`](docs/) | Architecture rules, research, implementation plans. |
| [`docker/`](docker/) | Optional local PostgreSQL compose. |

```text
dupply-backend/
  package.json              # npm workspaces root
  packages/
    api/                      # @dupply/api
    indexer/                  # @dupply/indexer
  soroban/
    Cargo.toml                # Rust workspace (members: crates/*)
    crates/duplicata-registry/
```

The **frontend** (`dupply-frontend`) lives in a separate repository.

---

## Quick start (API)

From the **repository root**:

```bash
npm install
npm run dev:api
```

Or work inside the package:

```bash
cd packages/api
cp .env.example .env
# Edit .env: DUPPLY_API_KEY, DUPPLY_REGISTRY_CONTRACT_ID, etc.
npm install
npm run dev
```

Details: **[packages/api/README.md](packages/api/README.md)** (routes, env, Etherfuse, Stellar, Wasm bindings).

HTTP endpoints (prefix = server root, e.g. `http://localhost:8080`):

| Method | Path | Authentication | Description |
|--------|------|----------------|-------------|
| GET | `/health` | — | Liveness. |
| GET | `/v1/ramp/assets` | Header `X-Dupply-Api-Key` | Resolves ramp assets (query params: `blockchain`, `currency`, `wallet`). Requires `ETHERFUSE_API_KEY`. |
| POST | `/v1/ramp/quotes` | Header `X-Dupply-Api-Key` | Creates Etherfuse quote; persists `ramp_quotes`. Requires `ETHERFUSE_API_KEY`. |
| POST | `/v1/ramp/orders` | `X-Dupply-Api-Key` | Creates order from a quote; persists `ramp_orders`. |
| GET | `/v1/ramp/orders/:id` | `X-Dupply-Api-Key` | Order state from DB (`id` = Dupply internal UUID). |
| POST | `/v1/duplicatas` | `X-Dupply-Api-Key` | Validates payload, simulates `issue`, stores draft, returns `unsignedTransactionXdr`. |
| POST | `/v1/duplicatas/:id/confirm` | `X-Dupply-Api-Key` | Body `{ "txHash": "..." }`; confirms tx on RPC and stores on-chain record. |
| GET | `/v1/duplicatas/:id` | `X-Dupply-Api-Key` | Draft + associated chain record. |
| GET | `/v1/duplicatas/on-chain/:chainId` | `X-Dupply-Api-Key` | `get_duplicata` read; required query `?issuer=G...`. |
| POST | `/v1/webhooks/etherfuse` | Header `X-Signature` (HMAC); JSON body | Etherfuse webhook; **does not** use `X-Dupply-Api-Key`. Requires `ETHERFUSE_WEBHOOK_SECRET`. |

Duplicata flow (summary): the API **does not** custody the issuer key — it returns simulated **XDR**; signing and `sendTransaction` are the client’s responsibility (wallet or Stellar CLI); then **`POST /v1/duplicatas/:id/confirm`** with the `txHash`.

---

## Soroban contract (`duplicata-registry`)

```bash
cd soroban
cargo test -p duplicata-registry
stellar contract build
```

- **Rust:** [soroban/rust-toolchain.toml](soroban/rust-toolchain.toml) pins **`1.92.0`** and `wasm32v1-none` (required by `stellar contract build`).
- **Wasm:** `soroban/target/wasm32v1-none/release/duplicata_registry.wasm`
- **Testnet deploy (optional):** [soroban/scripts/deploy-testnet.sh](soroban/scripts/deploy-testnet.sh) — needs `STELLAR_IDENTITY` and the Wasm already built; see [soroban/DEPLOYMENT-testnet.md](soroban/DEPLOYMENT-testnet.md).

Product spec (cross-reference to frontend): `dupply-frontend/docs/notes/2026-05-15_stellar-duplicata-master-implementation-guide.md`.

---

## Local PostgreSQL (optional)

Postgres 16 in Docker for development — [docker/README.md](docker/README.md). The API still defaults to **SQLite**; switching to Postgres requires Drizzle changes (dialect + `DATABASE_URL`).

---

## Indexer

[packages/indexer/README.md](packages/indexer/README.md) and `packages/indexer/src/index.js`.

---

## Documentation (research and plans)

- [docs/ARCHITECTURE-RULES.md](docs/ARCHITECTURE-RULES.md) — layering, CQRS discipline, “who may call whom”.  
- [docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md](docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md) — DDD/CQRS migration phases for the API package.  
- [DECISIONS.md](DECISIONS.md) — architecture decision log (short entries).  
- [docs/research/2026-05-16_stellar-anchors-seps-and-directory.md](docs/research/2026-05-16_stellar-anchors-seps-and-directory.md) — anchors, SEP-24, Stellar directory.  
- [docs/research/2026-05-16_stellar-sep10-sep24-deep-dive.md](docs/research/2026-05-16_stellar-sep10-sep24-deep-dive.md) — SEP-10/24, SEP-38/45, security.  
- [docs/research/2026-05-16_etherfuse-stellar-fx-api.md](docs/research/2026-05-16_etherfuse-stellar-fx-api.md) — Etherfuse FX API and sandbox.  
- [docs/notes/2026-05-16_dupply-backend-v1-plan.md](docs/notes/2026-05-16_dupply-backend-v1-plan.md) — backend v1 plan.  
- [docs/notes/2026-05-17_dupply-api-stack.md](docs/notes/2026-05-17_dupply-api-stack.md) — API stack and decisions.  
- [docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md](docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md) — duplicata + contract (architecture).
