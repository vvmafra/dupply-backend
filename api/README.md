# Dupply API (v1)

Serviço HTTP (Fastify) com persistência SQLite (dev), rotas de **rampa** via [Etherfuse FX API](https://docs.etherfuse.com/overview) e webhook assinado (`X-Signature`, HMAC-SHA256 sobre JSON canonicalizado — ver [Verifying Webhooks](https://docs.etherfuse.com/guides/verifying-webhooks)).

## Requisitos

- Node.js 20+
- Chaves sandbox Etherfuse (`ETHERFUSE_API_KEY`) e um `customerId` de onboarding para testes reais de quote/order.

## Configuração

```bash
cp .env.example .env
# Editar .env — definir DUPPLY_API_KEY e (para rampa) ETHERFUSE_API_KEY
```

## Comandos

```bash
npm install
npm run dev
```

- `GET /health` — sem autenticação.
- `POST /v1/ramp/quotes`, `POST /v1/ramp/orders`, `GET /v1/ramp/orders/:id` — header **`X-Dupply-Api-Key`** igual a `DUPPLY_API_KEY`.
- `POST /v1/webhooks/etherfuse` — verificação por **`X-Signature`** e `ETHERFUSE_WEBHOOK_SECRET` (não usa `X-Dupply-Api-Key`).

## Base de dados

Migrações Drizzle em `drizzle/`. No arranque do servidor executa-se `migrate()` automaticamente.

Para alterar o schema: editar `src/db/schema.ts`, depois:

```bash
npm run db:generate
npm run db:migrate
```

(Em desenvolvimento podes usar `npm run db:push` em alternativa.)

## Smoke Etherfuse (direto à API)

Sem levantar o servidor Dupply — útil para validar credenciais:

```bash
export ETHERFUSE_API_KEY=...
export ETHERFUSE_SMOKE_CUSTOMER_ID=...   # UUID do onboarding sandbox
npm run etherfuse:smoke
```

Opcionais: `ETHERFUSE_SMOKE_TARGET_ASSET`, `ETHERFUSE_SMOKE_AMOUNT`, `ETHERFUSE_SMOKE_WALLET_ADDRESS`.

## Referências oficiais

- Etherfuse overview — https://docs.etherfuse.com/overview  
- POST /ramp/quote — https://docs.etherfuse.com/api-reference/quotes/get-quote-for-conversion  
- POST /ramp/order — https://docs.etherfuse.com/api-reference/orders/create-a-new-order  
- Plano Dupply v1 — `../docs/notes/2026-05-16_dupply-backend-v1-plan.md`
