# Dupply API (v1)

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
- **Rampa** (`X-Dupply-Api-Key`): `POST /v1/ramp/quotes`, `POST /v1/ramp/orders`, `GET /v1/ramp/orders/:id`.
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
  --wasm ../contracts/duplicata-registry/target/wasm32v1-none/release/duplicata_registry.wasm \
  --output-dir /tmp/dupply-registry-ts --overwrite
# Copiar /tmp/dupply-registry-ts/src/index.ts -> src/generated/duplicata-registry-contract.ts
# Remover re-exports `export * from "@stellar/stellar-sdk"` e o bloco `window.Buffer` (Node).
```

## Smoke Etherfuse (direto à API)

```bash
export ETHERFUSE_API_KEY=...
export ETHERFUSE_SMOKE_CUSTOMER_ID=...
npm run etherfuse:smoke
```

Opcionais: `ETHERFUSE_SMOKE_TARGET_ASSET`, `ETHERFUSE_SMOKE_AMOUNT`, `ETHERFUSE_SMOKE_WALLET_ADDRESS`.

## Referências oficiais

- Stellar Soroban — https://developers.stellar.org/docs/build/smart-contracts  
- Etherfuse overview — https://docs.etherfuse.com/overview  
- POST /ramp/quote — https://docs.etherfuse.com/api-reference/quotes/get-quote-for-conversion  
- POST /ramp/order — https://docs.etherfuse.com/api-reference/orders/create-a-new-order  
- Plano v1 — `../docs/notes/2026-05-16_dupply-backend-v1-plan.md`  
- Arquitetura duplicata + contrato — `../docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md`
