# dupply-backend

Dupply backend repository: **Soroban duplicata registry**, **HTTP API v1**, and **indexer** (MVP).

| Component | Directory | Role |
|-----------|-----------|------|
| Contract | [`contracts/duplicata-registry/`](contracts/duplicata-registry/) | `DuplicataRegistry` — `issue`, issuer allowlist, on-chain events. |
| API | [`api/`](api/) | Fastify: **Etherfuse** ramp, **duplicata** flow (simulate → XDR → confirm `txHash`), SQLite in dev. |
| Indexer | [`indexer/`](indexer/) | Node skeleton for events / Horizon (see indexer README). |

The **frontend** (`dupply-frontend`) lives in a separate repository; changes here do not include it unless explicitly requested.

---

## API v1

Node + TypeScript service: see **[api/README.md](api/README.md)** (routes, env vars, Etherfuse, Stellar, regenerating Wasm bindings).

```bash
cd api
cp .env.example .env
# Edit .env: DUPPLY_API_KEY, DUPPLY_REGISTRY_CONTRACT_ID, etc.
npm install
npm run dev
```

HTTP endpoints (prefix = server root, e.g. `http://localhost:8080`):

| Method | Path | Authentication | Description |
|--------|------|----------------|-------------|
| GET | `/health` | — | Liveness. |
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
cd contracts/duplicata-registry
cargo test -p duplicata-registry
stellar contract build
```

- Rust toolchain: [rust-toolchain.toml](contracts/duplicata-registry/rust-toolchain.toml) (pin required by `stellar contract build` CLI).
- Release Wasm: `contracts/duplicata-registry/target/wasm32v1-none/release/duplicata_registry.wasm`
- Testnet deploy (optional): [scripts/deploy-testnet.sh](contracts/duplicata-registry/scripts/deploy-testnet.sh) and [DEPLOYMENT-testnet.md](contracts/duplicata-registry/DEPLOYMENT-testnet.md).

Product spec (cross-reference to frontend): `dupply-frontend/docs/notes/2026-05-15_stellar-duplicata-master-implementation-guide.md`.

---

## Local PostgreSQL (optional)

Postgres 16 in Docker for development — [docker/README.md](docker/README.md). The API still defaults to **SQLite**; switching to Postgres requires Drizzle changes (dialect + `DATABASE_URL`).

---

## Indexer

[Indexer README](indexer/README.md) and `indexer/src/index.js`.

---

## Documentation (research and plans)

- [docs/research/2026-05-16_stellar-anchors-seps-and-directory.md](docs/research/2026-05-16_stellar-anchors-seps-and-directory.md) — anchors, SEP-24, Stellar directory.  
- [docs/research/2026-05-16_stellar-sep10-sep24-deep-dive.md](docs/research/2026-05-16_stellar-sep10-sep24-deep-dive.md) — SEP-10/24, SEP-38/45, security.  
- [docs/research/2026-05-16_etherfuse-stellar-fx-api.md](docs/research/2026-05-16_etherfuse-stellar-fx-api.md) — Etherfuse FX API and sandbox.  
- [docs/notes/2026-05-16_dupply-backend-v1-plan.md](docs/notes/2026-05-16_dupply-backend-v1-plan.md) — backend v1 plan.  
- [docs/notes/2026-05-17_dupply-api-stack.md](docs/notes/2026-05-17_dupply-api-stack.md) — `api/` stack and decisions.  
- [docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md](docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md) — duplicata + contract (architecture).
