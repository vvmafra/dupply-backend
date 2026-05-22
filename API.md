# Dupply HTTP API (v1)

Code lives in **`src/`** at the repository root. Install and run:

```bash
npm install
npm run dev
```

See also [README.md](README.md) for repository overview. The service is **Fastify** with SQLite (dev): **platform auth + receivables** (JWT + Argon2), **ramp** via [Etherfuse FX API](https://docs.etherfuse.com/overview), **trade bills** via the Soroban `TradeBillRegistry` contract (TypeScript bindings generated from the crate Wasm), and signed Etherfuse webhooks (`X-Signature` — [Verifying Webhooks](https://docs.etherfuse.com/guides/verifying-webhooks)).

## Requirements

- Node.js 20+
- For ramp: Etherfuse sandbox keys and onboarding `customerId`.
- For trade bills: `DUPPLY_REGISTRY_CONTRACT_ID` (testnet) and issuer on the contract **allowlist**; the issuer signs the XDR returned by the API. The issuer account must exist on the network (for sequence and Soroban simulation).

## Configuration

```bash
cp .env.example .env
# DUPPLY_API_KEY — ramp, trade-bills, and internal settlement routes
# JWT_SECRET (min 16 chars) — /v1/auth/* and Bearer auth on /v1/receivables/*
# Optional: JWT_ACCESS_TTL_SECONDS, JWT_ISSUER, ETHERFUSE_* , DUPPLY_REGISTRY_CONTRACT_ID , SOROBAN_RPC_URL , STELLAR_NETWORK
```

## Commands

```bash
npm install
npm run dev
```

### Routes

- `GET /health` — no authentication.
- **Auth** (no Bearer; body JSON):
  - `POST /v1/auth/login` — `{ "email", "password" }` for `principal_kind=human`; returns `{ accessToken, tokenType, expiresInSeconds }`.
  - `POST /v1/auth/service-login` — `{ "email", "apiKey" }` for `principal_kind=service` (API key stored hashed in DB).
- **Receivables** (`Authorization: Bearer <accessToken>`):
  - `GET /v1/receivables` — list (seller: own; payer: own; admin / risk / risk_analyst_agent: up to 200 rows).
  - `GET /v1/receivables/:id` — detail if caller may view.
  - `POST /v1/receivables` — **seller**; body `{ "payerUserId" (UUID), "value", "receivableMd"? }`; creates row with `status=under_review` and `created_at_ms` / `updated_at_ms`.
  - `POST /v1/receivables/:id/risk-decision` — **risk_analyst** or **risk_analyst_agent**; body `{ "decision": "offer" | "reject", "proposedValue"? }` (`proposedValue` required when `decision` is `offer`).
  - `POST /v1/receivables/:id/confirm` — **payer** bound to `payer_user_id`; moves `offer` → `confirmed`.
- **Internal settlement** (`X-Dupply-Api-Key` only — workers / BFF; not for end users):  
  - `POST /v1/internal/receivables/:id/advance-settlement` — body `{ "targetStatus": "processing" | "completed" }`; enforces `confirmed` → `processing` → `completed` with **system** transition rules.
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

### Etherfuse KYC (programmatic, sandbox)

When the hosted onboarding UI is stuck, submit identity via API (personal customers on sandbox often auto-approve):

```bash
# .env must have a real sandbox ETHERFUSE_API_KEY (not a docs URL)
npm run etherfuse:kyc-smoke
```

Optional: `ETHERFUSE_KYC_CUSTOMER_ID`, `ETHERFUSE_KYC_WALLET`, `ETHERFUSE_KYC_SKIP_ORG=1` if the child org already exists. On success the script prints `ETHERFUSE_SMOKE_CUSTOMER_ID` and `ETHERFUSE_SMOKE_WALLET_ADDRESS` for `etherfuse:smoke`.

Refs: [Onboard — Programmatic](https://docs.etherfuse.com/guides/onboarding-programmatic), [Submit KYC](https://docs.etherfuse.com/api-reference/kyc/submit-kyc-identity-data).

### Etherfuse (HTTP)

With `npm run dev` and `.env` containing `DUPPLY_API_KEY` + `ETHERFUSE_API_KEY`:

```bash
BASE=http://localhost:8080
curl -sS "$BASE/v1/ramp/assets?blockchain=stellar&currency=brl&wallet=G..." \
  -H "X-Dupply-Api-Key: $DUPPLY_API_KEY"
```

### Platform (migrate + seed)

```bash
mkdir -p data
DATABASE_URL=file:./data/dupply.db npm run db:migrate
DATABASE_URL=file:./data/dupply.db JWT_SECRET='your-secret-at-least-16-chars' npm run seed:platform:dev
# Human dev password: dev-password-change-me (see script output for one-time service API key)
```

### Receivable lifecycle (HTTP)

Requires `JWT_SECRET`, `DUPPLY_API_KEY`, and seeded users (`npm run seed:platform:dev`). Use `sqlite3` on `DATABASE_URL` to read `platform_users.id` for `payerUserId`.

```bash
BASE=http://localhost:8080
TOKEN=$(curl -sS -X POST "$BASE/v1/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"seller@dupply.dev.local","password":"dev-password-change-me"}' | jq -r .accessToken)
curl -sS "$BASE/v1/receivables" -H "Authorization: Bearer $TOKEN"
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
