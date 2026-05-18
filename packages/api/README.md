# Dupply API (v1)

Pacote **`@dupply/api`** do monorepo `dupply-backend`. Na raiz do repositório: `npm install` e `npm run dev:api` (ou `cd packages/api && npm run dev`).

Serviço HTTP (Fastify) com persistência SQLite (dev): **rampa** via [Etherfuse FX API](https://docs.etherfuse.com/overview), **duplicatas** via contrato Soroban `duplicata-registry` (bindings TypeScript gerados a partir do Wasm do crate), e webhook Etherfuse assinado (`X-Signature` — [Verifying Webhooks](https://docs.etherfuse.com/guides/verifying-webhooks)).

## Requisitos

- Node.js 20+
- Para rampa: chaves sandbox Etherfuse e `customerId` de onboarding.
- Para duplicatas: `DUPPLY_REGISTRY_CONTRACT_ID` (testnet) e emitente na **allowlist** do contrato; o emitente assina o XDR devolvido pela API. A conta do emitente tem de existir na rede (para sequência e simulação Soroban).

## Configuração

```bash
cp .env.example .env
# DUPPLY_API_KEY (obrigatório para /v1/ramp e /v1/duplicatas)
# Opcional: ETHERFUSE_* , DUPPLY_REGISTRY_CONTRACT_ID , SOROBAN_RPC_URL , STELLAR_NETWORK
```

## Comandos

```bash
npm install
npm run dev
```

### Rotas

- `GET /health` — sem autenticação.
- **Rampa** (`X-Dupply-Api-Key`): `GET /v1/ramp/assets`, `POST /v1/ramp/quotes`, `POST /v1/ramp/orders`, `GET /v1/ramp/orders/:id`.
- **Duplicatas** (`X-Dupply-Api-Key`):  
  - `POST /v1/duplicatas` — valida payload, simula `issue`, grava draft, devolve `unsignedTransactionXdr`.  
  - `POST /v1/duplicatas/:id/confirm` — corpo `{ "txHash": "..." }` após submissão on-chain; grava `chain_duplicata_id`.  
  - `GET /v1/duplicatas/:id` — draft + registo chain (se existir).  
  - `GET /v1/duplicatas/on-chain/:chainId?issuer=G...` — `get_duplicata` via simulação (leitura).
- `POST /v1/webhooks/etherfuse` — `X-Signature` + `ETHERFUSE_WEBHOOK_SECRET`.

## Base de dados

Migrações Drizzle em `drizzle/`. No arranque do servidor executa-se `migrate()` automaticamente.

Para alterar o schema: editar `src/db/schema.ts`, depois:

```bash
npm run db:generate
npm run db:migrate
```

(Em desenvolvimento podes usar `npm run db:push` em alternativa.)

## Regenerar bindings do contrato

Após mudar o Rust e `stellar contract build`, gerar TypeScript para o Wasm e **substituir** `src/generated/duplicata-registry-contract.ts` (ajustar `import type` se a CLI gerar imports mistos — o projeto usa `verbatimModuleSyntax`).

```bash
stellar contract bindings typescript \
  --wasm ../../soroban/target/wasm32v1-none/release/duplicata_registry.wasm \
  --output-dir /tmp/dupply-registry-ts --overwrite
# Copiar /tmp/dupply-registry-ts/src/index.ts -> src/generated/duplicata-registry-contract.ts
# Remover re-exports `export * from "@stellar/stellar-sdk"` e o bloco `window.Buffer` (Node).
```

## Regressão / smoke (checklist PR)

Copiar para a descrição do PR após refactors na API. Ajustar `BASE` e secrets localmente.

### Etherfuse (script)

```bash
export ETHERFUSE_API_KEY=...
export ETHERFUSE_SMOKE_CUSTOMER_ID=...
npm run etherfuse:smoke
```

Opcionais: `ETHERFUSE_SMOKE_TARGET_ASSET`, `ETHERFUSE_SMOKE_AMOUNT`, `ETHERFUSE_SMOKE_WALLET_ADDRESS`.

### Etherfuse (HTTP)

Com `npm run dev` e `.env` com `DUPPLY_API_KEY` + `ETHERFUSE_API_KEY`:

```bash
BASE=http://localhost:8080
curl -sS "$BASE/v1/ramp/assets?blockchain=stellar&currency=brl&wallet=G..." \
  -H "X-Dupply-Api-Key: $DUPPLY_API_KEY"
```

### Duplicatas (HTTP)

Requer `DUPPLY_REGISTRY_CONTRACT_ID`, `SOROBAN_RPC_URL`, emitente na allowlist e corpo válido (ver `src/domain/duplicata/dto.ts`).

```bash
BASE=http://localhost:8080
HDR=( -H "Content-Type: application/json" -H "X-Dupply-Api-Key: $DUPPLY_API_KEY" )

# 1) Simular issue (substituir corpo pelo payload real)
curl -sS "$BASE/v1/duplicatas" "${HDR[@]}" -d '{ ... }'

# 2) Após submeter o XDR na rede: confirmar com tx hash
curl -sS "$BASE/v1/duplicatas/<DRAFT_ID>/confirm" "${HDR[@]}" -d '{"txHash":"<HEX>"}'

# 3) Ler draft + chain record
curl -sS "$BASE/v1/duplicatas/<DRAFT_ID>" "${HDR[@]}"
```

## Referências oficiais

- Stellar Soroban — https://developers.stellar.org/docs/build/smart-contracts  
- Etherfuse overview — https://docs.etherfuse.com/overview  
- POST /ramp/quote — https://docs.etherfuse.com/api-reference/quotes/get-quote-for-conversion  
- POST /ramp/order — https://docs.etherfuse.com/api-reference/orders/create-a-new-order  
- Plano v1 — `../../docs/notes/2026-05-16_dupply-backend-v1-plan.md`  
- Arquitetura duplicata + contrato — `../../docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md`  
- Regras de arquitetura API — `../../docs/ARCHITECTURE-RULES.md`  
- Plano DDD + CQRS — `../../docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md`  
