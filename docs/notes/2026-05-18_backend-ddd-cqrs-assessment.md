# Backend Dupply: avaliação para DDD + CQRS

**Data:** 2026-05-18  
**Objetivo:** mapear a arquitetura **atual** do serviço `api/`, contrastar com **DDD** (Domain-Driven Design) e **CQRS** (Command Query Responsibility Segregation), e listar o que **manter**, **refatorar** ou **introduzir** — sem comprometer ainda com datas ou “big bang”.  
**Leituras oficiais / canónicas (prioridade):** [Martin Fowler — CQRS](https://martinfowler.com/bliki/CQRS.html), [Azure Architecture Center — CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs), [DDD Reference (Eric Evans / Domain Language)](https://www.domainlanguage.com/ddd/reference/).

---

## 1. O que queremos dizer com DDD + CQRS (neste repo)

| Conceito | Significado prático aqui |
|----------|---------------------------|
| **DDD** | Fronteiras de **domínio** claras (Duplicata no registry Soroban vs Rampa Etherfuse), linguagem ubíqua alinhada ao contrato/API, regras de negócio **fora** dos handlers HTTP, modelos ricos ou serviços de domínio onde fizer sentido, **anti-corruption layer** entre “nosso domínio” e SDKs (Stellar, Etherfuse). |
| **CQRS** | Separar **comandos** (alteram estado: criar quote, criar ordem, simular `issue`, confirmar `txHash`, aplicar webhook) de **consultas** (só leem: `GET` ramp order, `GET` duplicata, assets, `get_duplicata` on-chain). Pode ser só **separação em módulos** no início; **modelos de leitura** separados (projeções) só quando houver ganho mensurável. |

**Não é obrigatório** na primeira iteração: Event Sourcing, message bus distribuído, ou read models em BD separado — CQRS é um **espectro** ([Fowler](https://martinfowler.com/bliki/CQRS.html)).

---

## 2. Mapa do que existe hoje (`api/`)

```
api/src/
├── server.ts                 # composição: DB, migrações, registo de rotas
├── config.ts                 # env / AppConfig
├── db/
│   ├── index.ts              # Drizzle + SQLite, migrate no boot
│   └── schema.ts             # tabelas: ramp_quotes, ramp_orders, duplicata_drafts, duplicata_chain_records
├── plugins/
│   └── dupply-auth.ts        # X-Dupply-Api-Key
├── routes/v1/
│   ├── ramp.ts               # GET assets, POST quotes, POST orders, GET order — Zod + EtherfuseClient + Drizzle inline
│   ├── duplicatas.ts         # POST/GET duplicatas, confirm — Zod + domain + issue-flow + confirm-tx + Drizzle inline
│   └── webhook-etherfuse.ts  # POST webhook — verificação assinatura + update ramp_orders
├── domain/duplicata/
│   ├── dto.ts                # Zod schemas + validateIssueInvariants + DomainError
│   └── map-issue-payload.ts  # HTTP body → IssuePayload (contrato)
├── integrations/
│   ├── etherfuse/            # client HTTP, webhook-verify
│   ├── registry/             # issue-flow (simulate), confirm-tx
│   └── stellar/              # network passphrase helper
└── generated/                # bindings Soroban (gerados)
```

### 2.1 Forças atuais (o que já está bem encaminhado)

- **Integrações isoladas** em `integrations/` (Etherfuse, registry, Stellar).  
- **Duplicata**: parte de validação e mapeamento DTO → contrato em `domain/duplicata/`.  
- **Persistência** explícita em Drizzle com schema único.  
- **Erros de domínio** tipados em vários sítios (`DomainError`, `IssuerNotAllowedError`, etc.) e mapeados para HTTP nas rotas.

### 2.2 Limitações vs DDD + CQRS (dívida estrutural)

| Área | Situação hoje | Tensão |
|------|----------------|--------|
| **Application layer** | Lógica de orquestração (validar → chamar integração → `db.insert/update`) mora nas **rotas** (`ramp.ts`, `duplicatas.ts`). | Rotas ficam grandes; difícil testar fluxo sem HTTP; mistura “caso de uso” com serialização. |
| **Ramp** | Não há pasta `domain/ramp`; regras e shapes Zod estão colados ao Fastify. | Segundo bounded context sem “coração” de domínio visível. |
| **CQRS** | `GET` e `POST` partilham os mesmos tipos/tabelas e o mesmo código de acesso; não há interfaces `CommandHandler` / `QueryHandler`. | Evolução para read models ou filas fica sem encaixe natural. |
| **Repositórios** | Drizzle chamado **diretamente** nas rotas. | Domínio fica acoplado a SQL/Drizzle; troca de BD ou testes com duplos exige mockar módulos de rota. |
| **Webhook** | Atualização de `ramp_orders` inline após verificar assinatura. | É um **comando** assíncrono na prática; poderia ser handler + idempotência explícita (event id). |
| **Bounded contexts** | Dois contextos (Ramp / Duplicata) partilham `server.ts`, `db`, auth. | OK para monólito modular; falta só **fronteira explícita** (pastas ou pacotes `application/ramp`, `application/duplicata`). |

---

## 3. Visão alvo (alto nível) — monólito modular DDD-friendly + CQRS leve

```text
┌─────────────────────────────────────────────────────────────┐
│  interfaces/http (Fastify) — controllers finos             │
│    → traduz HTTP ↔ Command / Query DTOs                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  application (casos de uso)                                 │
│    commands/   CreateRampQuoteHandler, ConfirmDuplicata…    │
│    queries/    GetRampOrderHandler, GetDuplicataHandler…    │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌──────────────────────┐
│ domain/       │  │ domain/        │  │ integrations/       │
│ duplicata     │  │ ramp (novo)    │  │ etherfuse, stellar  │
│ (entidades,   │  │ políticas,     │  │ registry, …         │
│  serviços)    │  │  value objects)│  │ (ACL)               │
└───────┬───────┘  └────────┬───────┘  └──────────┬───────────┘
        │                   │                     │
        └───────────────────┼─────────────────────┘
                            ▼
                 ┌─────────────────────┐
                 │ infrastructure/     │
                 │ drizzle repos,      │
                 │ migrations          │
                 └─────────────────────┘
```

- **Commands** retornam void ou um id / resultado mínimo; falhas como `Result` ou exceções de domínio mapeadas uma vez no HTTP.  
- **Queries** não alteram estado; podem usar o mesmo Drizzle ou, mais tarde, views/read models.

---

## 4. Inventário por bounded context

### 4.1 Rampa (Etherfuse)

| Operação (HTTP) | Tipo CQRS | Hoje | Refatoração sugerida |
|-----------------|-----------|------|----------------------|
| `GET /v1/ramp/assets` | Query | Rota + `EtherfuseClient` | `GetRampAssetsQuery` + handler; client injetado. |
| `POST /v1/ramp/quotes` | Command | Rota + client + insert quote | `CreateRampQuoteCommand` + `RampQuoteRepository` + domínio mínimo (expiração, provider). |
| `POST /v1/ramp/orders` | Command | Rota + client + insert order | `CreateRampOrderCommand` + validar quote existente no domínio/repo. |
| `GET /v1/ramp/orders/:id` | Query | Rota + select | `GetRampOrderByIdQuery`; opcionalmente projeção DTO de leitura. |
| Webhook Etherfuse | Command | `webhook-etherfuse.ts` | `ApplyRampWebhookCommand` + idempotência (`eventId` se existir na payload). |

### 4.2 Duplicata (registry Soroban)

| Operação (HTTP) | Tipo CQRS | Hoje | Refatoração sugerida |
|-----------------|-----------|------|----------------------|
| `POST /v1/duplicatas` | Command | Rota + `validateIssueInvariants` + `simulateIssue` + insert | `SimulateDuplicataIssueCommand` + agregar `DuplicataDraft` (opcional) ou serviço de domínio. |
| `POST /v1/duplicatas/:id/confirm` | Command | Rota + `parseSuccessfulIssueTx` + inserts | `ConfirmDuplicataTxCommand`. |
| `GET /v1/duplicatas/:id` | Query | Rota + joins lógicos | `GetDuplicataByIdQuery`. |
| `GET /v1/duplicatas/on-chain/:chainId` | Query | Rota + simulação leitura | `GetDuplicataOnChainQuery` (ACL já em registry). |

---

## 5. O que refazer / arrumar (backlog sugerido)

### Fase A — CQRS “mecânico”, sem mudar BD

1. Criar `src/application/` com subpastas `commands`, `queries` (ou por contexto `ramp/`, `duplicata/`).  
2. Extrair cada fluxo das rotas para **uma função/handler** por caso de uso (`executeCreateRampQuote(...)`), com dependências explícitas (`deps: { rampQuoteRepo, etherfuse }`).  
3. Rotas: `parse` Zod → chamar handler → mapear erro → status HTTP (um único `mapDomainErrorToHttp` por contexto).  
4. Testes unitários nos handlers com **repos in-memory** ou Drizzle em memória.

### Fase B — Repositórios (DDD infrastructure)

1. Interfaces `RampQuoteRepository`, `RampOrderRepository`, `DuplicataDraftRepository`, `DuplicataChainRepository` em `domain` ou `application/ports`.  
2. Implementações Drizzle em `infrastructure/persistence/` (thin wrappers sobre `schema.ts`).  
3. `domain/duplicata` ganha tipos de agregado ou factory se quiserem invariantes no objeto (ex.: não permitir `confirm` sem `simulated`).

### Fase C — Domínio ramp

1. `domain/ramp/` com value objects (`QuoteAssets`, `MoneyAmount` string) se quiserem validação central.  
2. Política de `resolveAssetIdentifiers` como serviço de domínio chamando a ACL Etherfuse.

### Fase D — CQRS “mais forte” (opcional, com critério)

1. DTOs de **leitura** distintos dos modelos de escrita (ex.: `RampOrderReadModel` sem `requestJson` bruto se não for necessário na API pública).  
2. Webhook enfileirado (BullMQ / fila interna) se volume ou retries exigirem — alinha com “command assíncrono”.  
3. Read replica ou materialized view só se latência/consultas complexas justificarem.

---

## 6. O que **não** precisa mudar à pressa

- **Schema Drizzle** e migrações (só renomear colunas se a linguagem ubíqua mudar).  
- **EtherfuseClient** e **issue-flow** como ACL — podem mudar de pasta para `infrastructure` mas a lógica HTTP/Soroban pode migrar aos poucos.  
- **Bindings gerados** em `generated/`.  
- **Contrato Soroban** e `IssuePayload` — fonte de verdade externa ao “estilo DDD”.

---

## 7. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Refactor grande sem entrega | Fases A→B; manter rotas estáveis; testes de contrato HTTP (smoke) após cada PR. |
| Over-engineering | Não introduzir agregados/event store até a equipa sentir dor (rotas > ~400 linhas ou bugs de estado). |
| Duplicação DTO | Partilhar Zod entre “HTTP input” e “command payload” (um schema, dois nomes). |

### Rollback

Qualquer fase é reversível com `git revert` se os handlers forem PRs pequenos; manter **mesmas URLs e JSON** na v1.

---

## 8. Critérios de “pronto o suficiente” para dizer que estamos em DDD + CQRS leve

- [ ] Nenhuma rota com orquestração > ~50 linhas (só delegação + erro HTTP).  
- [ ] Cada mutação de estado passa por um **command handler** nomeado pelo caso de uso.  
- [ ] Cada `GET` relevante passa por um **query handler**.  
- [ ] Persistência atrás de **ports** (interfaces) testáveis.  
- [ ] Documento ADR ou atualização a `DECISIONS.md` na raiz com a escolha “CQRS leve + monólito modular”.

---

## 9. Próximo passo recomendado

1. Aprovar este documento (ou ajustar vocabulário / fases).  
2. Abrir issue ou PR só da **Fase A** num bounded context (sugestão: **ramp** primeiro — maior volume de lógica na rota).  
3. Copiar smoke existente (`etherfuse-smoke`, `curl` manual) para checklist de regressão.

---

## Referências (links)

1. CQRS — Martin Fowler — https://martinfowler.com/bliki/CQRS.html  
2. CQRS pattern — Microsoft Azure Architecture — https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs  
3. DDD Reference — Domain Language — https://www.domainlanguage.com/ddd/reference/  
4. Plano v1 backend — `docs/notes/2026-05-16_dupply-backend-v1-plan.md`  
5. Arquitetura duplicata + contrato — `docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md`  
