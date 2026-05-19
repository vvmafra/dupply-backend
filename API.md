# Dupply HTTP API (v1)

Code lives in **`src/`** at the repository root. Install and run:

```bash
npm install
npm run dev
```

See also [README.md](README.md) for repository overview. The service is **Fastify** with SQLite (dev): **ramp** via [Etherfuse FX API](https://docs.etherfuse.com/overview), **trade bills** via the Soroban `TradeBillRegistry` contract (TypeScript bindings generated from the crate Wasm), and signed Etherfuse webhooks (`X-Signature` — [Verifying Webhooks](https://docs.etherfuse.com/guides/verifying-webhooks)).

## Requirements

- Node.js 20+
- For ramp: Etherfuse sandbox keys and onboarding `customerId`.
- For trade bills: `DUPPLY_REGISTRY_CONTRACT_ID` (testnet) and issuer on the contract **allowlist**; the issuer signs the XDR returned by the API. The issuer account must exist on the network (for sequence and Soroban simulation).

## Configuration

```bash
cp .env.example .env
# DUPPLY_API_KEY (required for /v1/ramp and /v1/trade-bills)
# Optional: ETHERFUSE_* , DUPPLY_REGISTRY_CONTRACT_ID , SOROBAN_RPC_URL , STELLAR_NETWORK
```

## Commands

```bash
npm install
npm run dev
```

### Routes

- `GET /health` — no authentication.
- **Ramp** (`X-Dupply-Api-Key`): `GET /v1/ramp/assets`, `POST /v1/ramp/quotes`, `POST /v1/ramp/orders`, `GET /v1/ramp/orders/:id`.
- **Trade bills** (`X-Dupply-Api-Key`):  
  - `POST /v1/trade-bills` — validates payload, simulates `issue`, stores draft, returns `unsignedTransactionXdr`.  
  - `POST /v1/trade-bills/:id/confirm` — body `{ "txHash": "..." }` after on-chain submission; stores `chainBillId`.  
  - `GET /v1/trade-bills/:id` — draft + chain record (if any).  
  - `GET /v1/trade-bills/on-chain/:chainId?issuer=G...` — `get_trade_bill` via simulation (read).
- `POST /v1/webhooks/etherfuse` — `X-Signature` + `ETHERFUSE_WEBHOOK_SECRET`.

## Database

Drizzle migrations in `drizzle/`. On server startup, `migrate()` runs automatically.

To change schema: edit `src/db/schema.ts`, then:

```bash
npm run db:generate
npm run db:migrate
```

(For local dev you may use `npm run db:push` instead.)

## Regenerate contract TypeScript bindings

After changing Rust and running `stellar contract build`, generate TypeScript from the Wasm and **replace** `src/generated/trade-bill-registry-contract.ts` (fix `import type` if the CLI emits mixed imports — this project uses `verbatimModuleSyntax`).

```bash
stellar contract bindings typescript \
  --wasm soroban/target/wasm32v1-none/release/duplicata_registry.wasm \
  --output-dir /tmp/dupply-registry-ts --overwrite
# Copy /tmp/dupply-registry-ts/src/index.ts -> src/generated/trade-bill-registry-contract.ts
# Remove re-exports `export * from "@stellar/stellar-sdk"` and the `window.Buffer` block (Node).
# Use `import type` for ContractClientOptions and MethodOptions if required by tsc.
```

## Regression / smoke (PR checklist)

Copy into the PR description after API refactors. Adjust `BASE` and secrets locally.

### Etherfuse (script)

```bash
export ETHERFUSE_API_KEY=...
export ETHERFUSE_SMOKE_CUSTOMER_ID=...
npm run etherfuse:smoke
```

Optional: `ETHERFUSE_SMOKE_TARGET_ASSET`, `ETHERFUSE_SMOKE_AMOUNT`, `ETHERFUSE_SMOKE_WALLET_ADDRESS`.

### Etherfuse (HTTP)

With `npm run dev` and `.env` containing `DUPPLY_API_KEY` + `ETHERFUSE_API_KEY`:

```bash
BASE=http://localhost:8080
curl -sS "$BASE/v1/ramp/assets?blockchain=stellar&currency=brl&wallet=G..." \
  -H "X-Dupply-Api-Key: $DUPPLY_API_KEY"
```

### Trade bills (HTTP)

Requires `DUPPLY_REGISTRY_CONTRACT_ID`, `SOROBAN_RPC_URL`, allowlisted issuer, and a valid body (see `src/domain/tradeBill/dto.ts`).

```bash
BASE=http://localhost:8080
HDR=( -H "Content-Type: application/json" -H "X-Dupply-Api-Key: $DUPPLY_API_KEY" )

# 1) Simulate issue (replace body with a real payload)
curl -sS "$BASE/v1/trade-bills" "${HDR[@]}" -d '{ ... }'

# 2) After submitting XDR on-chain: confirm with tx hash
curl -sS "$BASE/v1/trade-bills/<DRAFT_ID>/confirm" "${HDR[@]}" -d '{"txHash":"<HEX>"}'

# 3) Read draft + chain record
curl -sS "$BASE/v1/trade-bills/<DRAFT_ID>" "${HDR[@]}"
```

## Official references

- Stellar Soroban — https://developers.stellar.org/docs/build/smart-contracts  
- Etherfuse overview — https://docs.etherfuse.com/overview  
- POST /ramp/quote — https://docs.etherfuse.com/api-reference/quotes/get-quote-for-conversion  
- POST /ramp/order — https://docs.etherfuse.com/api-reference/orders/create-a-new-order  
- v1 plan — `docs/notes/2026-05-16_dupply-backend-v1-plan.md`  
- Trade bill + contract architecture — `docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md`  
- Architecture rules — `docs/ARCHITECTURE-RULES.md`  
- DDD + CQRS plan — `docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md`  
