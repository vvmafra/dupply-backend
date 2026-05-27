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
# CORS_ALLOWED_ORIGINS — comma-separated SPA origins (e.g. http://localhost:5173); dev defaults apply when unset
# Optional: JWT_ACCESS_TTL_SECONDS, JWT_REFRESH_TTL_SECONDS, JWT_ISSUER, ETHERFUSE_* , DUPPLY_REGISTRY_CONTRACT_ID , SOROBAN_RPC_URL , STELLAR_NETWORK
```

Access token claims: `sub` (account id), `role`, `profileId`. For **seller** accounts, `profileId` is the real `seller.id`. For `admin` and `risk_analyst`, `profileId` remains a mocked placeholder until their profile modules land.

**Money convention:** monetary API fields use **reais with 2 decimal places** (`number`, e.g. `150000.00`). Storage uses integer **cents** (e.g. `15000000` in seller JSON; receivable `value` / `proposedValue` as centavos text in DB). Applies to seller metadata (`shareCapital`, `annualRevenue`) and receivables (`value`, `proposedValue`, `receivableMetaData.desiredAnticipationValue`).

## Commands

```bash
npm install
npm run dev
```

### Routes

- `GET /health` — no authentication.
- **Auth** (no Bearer on login/refresh/register/logout; refresh token travels in an `HttpOnly` cookie):
  - `POST /v1/auth/register` — `{ "email", "password", "name", "role": "seller" }`; creates account + seller atomically; returns `201` with `{ accessToken, tokenType, expiresInSeconds, sellerId }` and sets cookie `dupply_rt`. Only `role: "seller"` is accepted in v1.
  - `POST /v1/auth/login` — `{ "email", "password" }`; returns `{ accessToken, tokenType, expiresInSeconds }` and sets cookie `dupply_rt` (`HttpOnly; SameSite=Lax; Path=/v1/auth`; `Secure` in production).
  - `POST /v1/auth/refresh` — **no body**; reads `dupply_rt` from the request cookie; returns `{ accessToken, tokenType, expiresInSeconds }` and rotates `dupply_rt`. Missing cookie → `401 { "error": "missing_refresh_token" }`.
  - `POST /v1/auth/logout` — **no body, no Bearer**; reads `dupply_rt`, invalidates the stored refresh token server-side, clears the cookie (`204`).
  - **SPA clients:** send `credentials: "include"` on all `/v1/auth/*` requests so the browser attaches `dupply_rt`. CORS is configured with `credentials: true` and an explicit origin allowlist (`CORS_ALLOWED_ORIGINS`).
- **Accounts** (`Authorization: Bearer <accessToken>`):
  - `GET /v1/accounts/me` — authenticated alias for the caller's own account; same response as `GET /v1/accounts/:id` when `:id` equals JWT `sub` (excludes password hash and refresh token).
  - `GET /v1/accounts/:id` — account profile (owner or admin; excludes password hash and refresh token).
  - `PATCH /v1/accounts/:id` — `{ "password" }`; owner or admin (`204`).
  - `DELETE /v1/accounts/:id` — admin soft-delete (`204`).
- **Sellers** (`Authorization: Bearer <accessToken>`):
  - `GET /v1/sellers` — admin lists all sellers; risk_analyst lists `in_review` only; optional `?status=` filter (admin).
  - `GET /v1/sellers/:id` — seller (own), admin (any), risk_analyst (`in_review` only).
  - `PATCH /v1/sellers/:id` — seller (own); partial metadata update while `status=created`; money fields in reais.
  - `POST /v1/sellers/:id/submit` — seller (own); validates completeness and transitions to `in_review` (`204`).
  - `PATCH /v1/sellers/:id/status` — admin; body `{ "status": "active" | "inactive" }` (`204`).
  - `DELETE /v1/sellers/:id` — admin soft-delete (`204`).
- **Wallets** (`Authorization: Bearer <accessToken>`):
  - `POST /v1/sellers/:id/wallet` — seller (own); body `{ "contractId", "credentialId", "signerPublicKey", "network": "testnet" | "mainnet", "createdTxHash"? }`; registers smart account after frontend SDK creation; returns `201` with wallet view (no `secretEncrypted`).
  - `GET /v1/sellers/:id/wallet` — seller (own) or admin; returns wallet view or `404 wallet_not_found` when `seller.walletId` is null.
  - `GET /v1/wallets/:id` — seller (own wallet) or admin.
  - `PATCH /v1/wallets/:id/status` — admin; body `{ "status": "active" | "inactive" }`.
- **Receivables** (`Authorization: Bearer <accessToken>`):
  - Lifecycle v2: `created` → `under_review` → `offer` | `reproved`; `offer` → `approved` | `rejected` (seller decision); payer confirmation and platform settlement are separate flows (magic link + internal routes).
  - **Money:** `value`, `proposedValue`, and `desiredAnticipationValue` (inside `receivableMetaData`) are **reais** in JSON request/response (e.g. `150000.00`); stored as centavos in DB — see money convention above.
  - `GET /v1/receivables` — **seller** (own rows); **admin** / **risk_analyst** / **risk_analyst_agent** (all non-deleted, up to 200). Returns `{ "receivables": ReceivableRow[] }`.
  - `GET /v1/receivables/:id` — **seller** (own), **admin**, **risk_analyst**, **risk_analyst_agent**; payer role forbidden. Returns `{ "receivable": ReceivableRow }`.
  - `POST /v1/receivables` — **seller**; body `{ "payerCnpj", "payerLegalName"?, "payerFinancialEmail"?, "value"?, "receivableMetaData"? }`; upserts payer by CNPJ; requires seller `status=active`; creates draft with `status=created`; returns `201 { "id" }`.
  - `POST /v1/receivables/submit` — **seller**; same body as create; validates complete metadata; creates receivable directly in `under_review` (atomic create+submit); returns `201 { "id", "status": "under_review" }`.
  - `PATCH /v1/receivables/:id` — **seller** (own); body `{ "value"?, "receivableMetaData"? }`; only when `status=created`; returns `{ "ok": true }`.
  - `POST /v1/receivables/:id/submit` — **seller** (own); validates metadata completeness; transitions `created` → `under_review`; returns `{ "ok": true }`.
  - `POST /v1/receivables/:id/risk-decision` — **risk_analyst** or **risk_analyst_agent**; body `{ "decision": "offer" | "reprove", "proposedValue"? }` (`proposedValue` required when `decision` is `offer`); returns `{ "ok": true }`.
  - `POST /v1/receivables/:id/seller-decision` — **seller** (own); body `{ "decision": "accept" | "reject" }` when `status=offer`; returns `{ "ok": true }`.
  - **Known errors** (`{ "error": "<code>" }` unless noted):
    - `seller_not_active` — `403`; seller not `active` on create/submit.
    - `incomplete_metadata` — `400`; submit without required metadata fields.
    - `metadata_locked` — `409`; PATCH when `status` ≠ `created`.
    - `seller_and_payer_must_differ` — `400`; seller CNPJ equals payer CNPJ.
    - `proposed_value_required_for_offer` — `400`; risk decision `offer` without `proposedValue`.
    - `invalid_receivable_transition` — `409`; illegal status transition.
    - Also: `receivable_not_found` (`404`), `not_owner` / `forbidden` (`403`), `receivable_deleted` (`409`), `proposed_value_not_allowed_for_reprove` (`400`).
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

### Platform (migrate)

```bash
mkdir -p data
DATABASE_URL=file:./data/dupply.db npm run db:migrate
# Account seeding deferred to seller module PRD — insert test accounts via SQL or future seed script.
```

### Receivable lifecycle (HTTP)

Requires `JWT_SECRET` and an active seller account. Payer is resolved by `payerCnpj` on create (upsert into `payers` table).

```bash
BASE=http://localhost:8080
# Login — response body has accessToken only; refresh token is in Set-Cookie dupply_rt
curl -sS -c cookies.txt -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"seller@dupply.dev.local","password":"dev-password-change-me"}'

TOKEN=$(curl -sS -b cookies.txt -c cookies.txt -X POST "$BASE/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"seller@dupply.dev.local","password":"dev-password-change-me"}' | jq -r .accessToken)

curl -sS "$BASE/v1/receivables" -H "Authorization: Bearer $TOKEN"

# Draft create (status=created)
curl -sS -X POST "$BASE/v1/receivables" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"payerCnpj":"12345678000199","value":1000}'
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
