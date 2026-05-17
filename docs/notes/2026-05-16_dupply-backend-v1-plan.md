# Plano de execução: backend Dupply v1 + integração de rampa (Anchor / Etherfuse)

**Data:** 2026-05-16  
**Escopo:** definir **v1** do serviço em `dupply-backend` (API + persistência + jobs) e **uma** integração inicial de **rampa/câmbio**, com preferência documentada por **Etherfuse FX API**, mantendo o desenho **extensível** para **anchor SEP-24** no futuro.  
**Artefactos existentes:** contrato Soroban `DuplicataRegistry` (ver `contracts/duplicata-registry/` e `DEPLOYMENT-testnet.md`); indexador Node em `indexer/`.

---

## 1. Objetivos do produto v1

| ID | Objetivo | Medida de sucesso |
|----|----------|-------------------|
| O1 | Expor API REST segura para o frontend (futuro) orquestrar duplicatas | OpenAPI publicado; auth mínima funcional |
| O2 | Persistir estado de negócio off-chain | PostgreSQL (ou SQLite só dev) com migrações |
| O3 | Integrar **um** provedor de rampa | Fluxo sandbox: quote → order → estado persistido |
| O4 | Correlacionar rampa com chain | Guardar `stellar_tx_hash` / `contract_id` / `duplicata_id` quando aplicável |
| O5 | Observabilidade | Logs estruturados, healthcheck, métricas básicas |

**Fora de escopo v1 (explícito):** novo UI; custódia centralizada de chaves de utilizador sem modelo legal claro; mainnet em produção sem revisão de compliance.

---

## 2. Arquitetura alvo (alto nível)

```mermaid
flowchart LR
  subgraph clients [Clientes]
    FE[Frontend futuro]
  end
  subgraph dupply_api [Dupply API v1]
    HTTP[HTTP REST]
    AUTH[Auth JWT ou API key]
    DUP[DuplicataService]
    RAILS[RailsProvider]
    DB[(PostgreSQL)]
  end
  subgraph external [Externos]
    EF[Etherfuse API]
    HZN[Horizon / RPC]
    SOR[Soroban contract]
  end
  FE --> HTTP
  HTTP --> AUTH
  AUTH --> DUP
  AUTH --> RAILS
  DUP --> DB
  RAILS --> EF
  DUP --> HZN
  DUP --> SOR
```

### 2.1 Módulos sugeridos

1. **`api/`** — rotas, validação de input, serialização, rate limit.  
2. **`domain/duplicata/`** — regras de negócio, IDs internos, ligação a eventos do indexador.  
3. **`integrations/rails/`** — interface `RailsProvider` + implementação `EtherfuseRailsProvider`.  
4. **`integrations/stellar/`** — leitura Horizon/RPC, preparação de XDR (se o backend assinar ou só simular).  
5. **`workers/`** — fila (ex.: BullMQ + Redis) para webhooks, reconciliação de estado de ordem.  
6. **`indexer/`** — já existe esqueleto; v1 pode consumir eventos e escrever na mesma BD via API interna ou lib partilhada.

---

## 3. Stack recomendada (decisão provisória)

| Camada | Escolha sugerida | Motivo |
|--------|------------------|--------|
| Runtime | Node.js 22 LTS | Alinha com `indexer/` existente |
| Framework | Fastify ou Hono | Performance, tipagem TS |
| ORM | Drizzle ou Prisma | Migrações e type-safety |
| Auth | JWT (RS256) servido pelo próprio backend + refresh opcional v2 | Simplicidade v1 |
| Fila | Redis + BullMQ | Webhooks e retries |
| Deploy | Docker + compose dev | Paridade local/CI |

**ADR obrigatório:** gravar em `docs/notes/` ou `DECISIONS.md` na raiz do backend a escolha final de framework e ORM após spike de 1 dia.

---

## 4. Modelo de dados (rascunho v1)

Entidades mínimas:

- **`users`** — id externo (wallet `G...` ou subject OIDC futuro), created_at.  
- **`duplicatas`** — campos espelhados do contrato + `chain_duplicata_id` + `contract_address` + `network` (testnet/mainnet).  
- **`ramp_quotes`** — provider (`etherfuse`), payload request/response JSON, `expires_at`, status.  
- **`ramp_orders`** — `quote_id`, `external_order_id`, estado, montantes, `user_id`.  
- **`chain_events`** — cursor do indexador, `tx_hash`, payload normalizado.

Índices: `(external_order_id, provider)`, `(user_id, created_at)`.

---

## 5. Integração Etherfuse (fases técnicas)

### Fase 0 — Spike (1–2 dias)

- Criar organização sandbox; gerar API key.  
- Script `curl` ou `scripts/etherfuse-smoke.ts`: autenticação → quote de teste → order de teste (conforme doc).  
- Documentar no `README` ou `docs/notes` os **HTTP status** e erros típicos.

### Fase 1 — Cliente HTTP interno

- Cliente com: timeouts, retries exponenciais (429/5xx), **redaction** de secrets em logs.  
- Tipos TypeScript gerados a partir de OpenAPI Etherfuse **se** disponível; caso contrário tipos manuais mínimos.

### Fase 2 — Endpoints Dupply

Exemplos de rotas (nomes ilustrativos):

- `POST /v1/ramp/quotes` — corpo: par de moedas, montante; resposta: id interno + dados Etherfuse.  
- `POST /v1/ramp/orders` — corpo: `quote_id` + confirmação; resposta: estado inicial.  
- `GET /v1/ramp/orders/:id` — estado consolidado (BD + refresh opcional na API).  

### Fase 3 — Webhooks

- Endpoint `POST /v1/webhooks/etherfuse` com verificação de assinatura (conforme doc).  
- Worker atualiza `ramp_orders` e emite notificação interna (websocket v2).

### Fase 4 — Ligação à duplicata

- Ao emitir `issue` on-chain (feito pelo cliente ou por transação preparada pelo backend), gravar `duplicata_id` e `ramp_order_id` na mesma transação DB (consistência eventual).

---

## 6. Integração “anchor SEP-24” (fase posterior, desenho)

Quando for necessário um anchor do **Anchor Directory**:

1. Resolver `HOME_DOMAIN` e `stellar.toml` (SEP-1).  
2. Implementar cliente **SEP-10** (challenge → sign → JWT).  
3. Abrir fluxo **SEP-24** (deposit/withdraw) conforme [Wallet SEP-24](https://developers.stellar.org/docs/build/apps/wallet/sep24).  
4. Opcional: UI redirect para URL hosted do anchor (o frontend Dupply, quando existir, abre webview ou browser).

Manter `Sep24RailsProvider` atrás da mesma interface `RailsProvider`.

---

## 7. Variáveis de ambiente (lista mínima)

```bash
# API
DUPPLY_API_PORT=8080
DUPPLY_JWT_ISSUER=dupply-dev
DATABASE_URL=postgres://...

# Stellar
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
DUPPLY_REGISTRY_CONTRACT_ID=CCX3BC6KKA2GLWJT5HQ5J5DPLRYSCUNPS6DXISJEBYIPWHEJTJBYFRWC

# Etherfuse
ETHERFUSE_BASE_URL=https://api.sand.etherfuse.com
ETHERFUSE_API_KEY=...
ETHERFUSE_ORG_ID=...
ETHERFUSE_WEBHOOK_SECRET=...
```

**Nota:** o `CONTRACT_ID` acima deve ser atualizado se houver novo deploy; a fonte de verdade continua a ser `DEPLOYMENT-testnet.md`.

---

## 8. Testes e critérios de aceitação v1

1. **Unitários:** `RailsProvider` com mock HTTP (nock/msw).  
2. **Integração:** testes contra sandbox Etherfuse em CI opcional (secrets no GitHub Actions).  
3. **Contrato:** testes Rust já existentes no crate; pipeline CI a correr `cargo test` no path do contrato.  
4. **Aceitação manual:** checklist em `docs/notes/` com screenshots ou `curl` de cada rota.

---

## 9. Riscos e rollback

| Risco | Mitigação | Rollback |
|-------|-----------|----------|
| Mudança de API Etherfuse | Versão client + monitorização | Feature flag `RAILS_PROVIDER=none` |
| Custos / limites de rate | Cache de quotes curtos, idempotência | Desligar rota pública |
| Segurança de webhook | Assinatura + replay window | Revogar secret |

---

## 10. Documentação cruzada

- Pesquisa Stellar SEP / anchors: `docs/research/2026-05-16_stellar-anchors-seps-and-directory.md`  
- Pesquisa Etherfuse: `docs/research/2026-05-16_etherfuse-stellar-fx-api.md`

---

## Referências

1. Stellar — SEP-24 wallet — https://developers.stellar.org/docs/build/apps/wallet/sep24  
2. Stellar — Anchor Platform SEP-24 — https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep24/getting-started  
3. Etherfuse docs — https://docs.etherfuse.com/  
4. Stellar press Etherfuse — https://stellar.org/press/etherfuse-to-join-stellar-network-in-2025-ceo-david-taylor-announces-at-the-stellar-meridian-conference-in-london  
