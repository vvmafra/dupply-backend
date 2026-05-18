# Plano de implementação: transição para DDD + CQRS leve (`api/`)

**Data:** 2026-05-19  
**Objetivo:** sequência de entregas **pequenas e reversíveis** que levem o serviço `api/` às regras em [`docs/ARCHITECTURE-RULES.md`](../ARCHITECTURE-RULES.md) e à visão em [`2026-05-18_backend-ddd-cqrs-assessment.md`](2026-05-18_backend-ddd-cqrs-assessment.md), **sem** parar o desenvolvimento de features nem quebrar contratos HTTP `/v1/*` sem versão nova.

**Princípio operacional:** um **PR = um caso de uso** (ou um grupo mínimo coeso); regressão verificada com smoke/manual + checklist abaixo.

---

## 1. Pré-requisitos (antes da Fase 1)

| # | Tarefa | Critério de pronto |
|---|--------|-------------------|
| P1 | Ler e alinhar equipa com `ARCHITECTURE-RULES.md` (matriz “quem fala com quem”). | Todos sabem onde colocar código novo. |
| P2 | Registar decisão em `DECISIONS.md` na raiz do `dupply-backend` (1 parágrafo: “CQRS leve + monólito modular; ports quando extrairmos handlers”). | Ficheiro criado ou secção acrescentada. |
| P3 | Garantir smoke/manual documentado: `npm run etherfuse:smoke`, fluxo duplicata (curl ou Postman) guardado em `docs/notes/` ou `api/README.md`. | Checklist copiável para cada PR de refactor. |

---

## 2. Estrutura de pastas alvo (incremental)

Não é obrigatório criar tudo no primeiro PR; **introduzir pastas vazias + um handler** basta para fixar o padrão.

```text
api/src/
├── application/
│   ├── ramp/
│   │   ├── commands/          # createQuote, createOrder, applyWebhook
│   │   ├── queries/         # getAssets, getOrderById
│   │   └── errors.ts        # opcional: erros de aplicação + map HTTP
│   ├── duplicata/
│   │   ├── commands/
│   │   └── queries/
│   └── ports/               # opcional na Fase 5: interfaces de repositório
├── infrastructure/
│   └── persistence/         # opcional na Fase 5: drizzle repos
├── routes/v1/               # mantém registo Fastify; handlers finos
├── domain/
│   ├── duplicata/           # já existe
│   └── ramp/                # Fase 6 (opcional): VOs / políticas
├── integrations/            # ACL; sem mudança obrigatória de pasta na Fase 1–4
└── db/                      # schema + migrate; repos podem importar daqui
```

---

## 3. Fases de implementação

### Fase 1 — Esqueleto de aplicação + composição

| Ordem | Entrega | Detalhes |
| ----- | ------- | -------- |
| 1.1 | Pasta `application/` + tipo `AppContext` ou `Deps` | Objeto passado a handlers: `{ db, config }` + fábrica de `EtherfuseClient` onde fizer sentido. |
| 1.2 | Função utilitária `registerRampRoutes` **só** delega | Ex.: `createRampQuoteHandler(deps)` importado de `application/ramp/commands/createRampQuote.ts`. |
| 1.3 | `server.ts` | Continua a criar `db`, `config`, a registar plugins; **não** crescer com lógica de negócio. |

**Critério de pronto:** `ramp.ts` tem **pelo menos um** endpoint delegado num ficheiro `application/ramp/...` (pode ser o mais simples primeiro: `GET /v1/ramp/assets` como **query**).

**Esforço:** M.

---

### Fase 2 — Rampa: extrair comandos e consultas (Etherfuse)

Ordem sugerida (do mais simples ao mais acoplado):

| # | Caso de uso | Tipo | Ficheiro sugerido | Notas |
|---|-------------|------|-------------------|--------|
| 2.1 | `GET /v1/ramp/assets` | Query | `application/ramp/queries/getRampAssets.ts` | Só chama `EtherfuseClient`; sem BD. |
| 2.2 | `GET /v1/ramp/orders/:id` | Query | `application/ramp/queries/getRampOrderById.ts` | Leitura Drizzle. |
| 2.3 | `POST /v1/ramp/quotes` | Command | `application/ramp/commands/createRampQuote.ts` | Etherfuse + insert `ramp_quotes`. |
| 2.4 | `POST /v1/ramp/orders` | Command | `application/ramp/commands/createRampOrder.ts` | Valida quote existente + Etherfuse + insert `ramp_orders`. |

**Critério de pronto:** `routes/v1/ramp.ts` **< ~80 linhas** de lógica total (só Zod + chamada handler + `mapRampErrorToReply`); comportamento JSON idêntico ao atual.

**Testes:** unitário do handler com `db` mock ou SQLite `:memory:` (opcional no PR 2.1–2.2; **recomendado** antes de fechar Fase 2).

**Esforço:** L (vários PRs).

---

### Fase 3 — Webhook Etherfuse

| Ordem | Entrega | Detalhes |
| ----- | ------- | -------- |
| 3.1 | `ApplyRampWebhookCommand` (nome ilustrativo) | `application/ramp/commands/applyRampWebhook.ts`: verificação de assinatura (delegar a `integrations/etherfuse/webhook-verify`) + atualização `ramp_orders`. |
| 3.2 | Idempotência | Se a payload tiver id de evento, persistir/processar uma vez (tabela ou coluna futura — só se a API garantir id; senão documentar “best effort”). |

**Critério de pronto:** `webhook-etherfuse.ts` fino; mesmos status HTTP que hoje.

**Esforço:** S–M.

---

### Fase 4 — Duplicata: comandos e consultas

| # | Caso de uso | Tipo | Ficheiro sugerido |
|---|-------------|------|-------------------|
| 4.1 | `POST /v1/duplicatas` | Command | `application/duplicata/commands/simulateDuplicataIssue.ts` |
| 4.2 | `POST /v1/duplicatas/:id/confirm` | Command | `application/duplicata/commands/confirmDuplicataTx.ts` |
| 4.3 | `GET /v1/duplicatas/:id` | Query | `application/duplicata/queries/getDuplicataById.ts` |
| 4.4 | `GET /v1/duplicatas/on-chain/:chainId` | Query | `application/duplicata/queries/getDuplicataOnChain.ts` |

**Critério de pronto:** `routes/v1/duplicatas.ts` apenas orquestra HTTP; `domain/duplicata` continua sem I/O; `integrations/registry` chamado **só** a partir de application (ou continua a ser chamado a partir de application após mover imports das rotas).

**Esforço:** L.

---

### Fase 5 — Ports e repositórios (infra)

| Ordem | Entrega | Detalhes |
| ----- | ------- | -------- |
| 5.1 | Interfaces em `application/ports/` | `RampQuoteRepository`, `RampOrderRepository`, `DuplicataDraftRepository`, `DuplicataChainRepository` — métodos mínimos (`save`, `findById`, …). |
| 5.2 | Implementações Drizzle | `infrastructure/persistence/*.ts` importam `schema.ts` e implementam as interfaces. |
| 5.3 | Composição em `server.ts` ou `compositionRoot.ts` | Instanciar repos reais e injetar nos handlers. |

**Critério de pronto:** handlers **não** importam `drizzle-orm` diretamente; testes dos handlers usam **fakes** das interfaces.

**Esforço:** L.

---

### Fase 6 — Domínio `ramp` (opcional)

| Entrega | Quando fazer |
| ------- | ------------- |
| `domain/ramp/` com VOs (`MoneyAmount`, política de `resolveAssetIdentifiers`) | Quando a lógica de ramp duplicar-se ou ficar difícil de testar sem tipos de domínio. |

**Critério de pronto:** regras que não são “formato HTTP” nem “colunas SQL” vivem em `domain/ramp`.

**Esforço:** M (depende do apetite).

---

### Fase 7 — CQRS “mais forte” (opcional)

Conforme [`2026-05-18_backend-ddd-cqrs-assessment.md`](2026-05-18_backend-ddd-cqrs-assessment.md) secção 5 Fase D:

- DTOs de leitura distintos para `GET` público.  
- Fila para webhook (BullMQ) só com requisito de volume/retries.  
- Read replica / views só com métrica ou requisito formal.

**Esforço:** variável; **não** bloquear Fases 1–5.

---

## 4. Ordem global recomendada (resumo)

```text
Fase 1 (esqueleto + 1 query ramp)
  → Fase 2 (restante ramp)
  → Fase 3 (webhook)
  → Fase 4 (duplicata)
  → Fase 5 (ports/repos)
  → Fase 6–7 (opcional)
```

**Motivo:** ramp concentra mais linhas em `ramp.ts` e **não** partilha domínio com duplicata — baixo risco de conflitos de merge; duplicata já tem `domain/` e exige cuidado com contrato Soroban.

---

## 5. Checklist por PR (copiar para descrição do PR)

- [ ] URLs e corpos de resposta `/v1/*` mantidos (ou documentada alteração + versão).  
- [ ] Imports respeitam [`ARCHITECTURE-RULES.md`](../ARCHITECTURE-RULES.md) secção 2.1.  
- [ ] Caso de uso identificado como **Command** ou **Query** no título ou corpo do PR.  
- [ ] Smoke/manual executado (listar comando na descrição).  
- [ ] Sem `process.env` novo fora de `config.ts`.  
- [ ] Sem imports cruzados **ramp ↔ duplicata** (regras de bounded context).

---

## 6. Definição de “transição concluída” (MVP arquitetural)

Cumprimento mínimo alinhado à avaliação (secção 8):

- [ ] Rotas `ramp`, `duplicatas` e `webhook-etherfuse` **finas** (≤ ~50 linhas de lógica por handler HTTP, só delegação + erro).  
- [ ] Todos os fluxos da secção “Inventário por bounded context” da avaliação têm **handler** em `application/`.  
- [ ] Repositórios atrás de **ports** (Fase 5) para pelo menos ramp **ou** duplicata completo; idealmente ambos.  
- [ ] `DECISIONS.md` atualizado.  
- [ ] `api/README.md` com parágrafo “Estrutura em camadas” apontando para `ARCHITECTURE-RULES.md`.

---

## 7. Riscos e mitigação

| Risco | Mitigação |
| ----- | ---------- |
| PR gigante | Cortar por endpoint/caso de uso; não misturar ramp + duplicata no mesmo PR. |
| Regressão em Etherfuse sandbox | Manter `etherfuse-smoke` verde em CI ou antes de merge manual. |
| Conflitos de tipos Zod duplicados | Um schema por payload; rotas fazem `parse` e passam **tipo já validado** ao handler. |

**Rollback:** `git revert` do PR; fases independentes facilitam.

---

## 8. Referências internas

| Documento | Uso |
| --------- | --- |
| [`docs/ARCHITECTURE-RULES.md`](../ARCHITECTURE-RULES.md) | Regras normativas e matriz de dependências. |
| [`2026-05-18_backend-ddd-cqrs-assessment.md`](2026-05-18_backend-ddd-cqrs-assessment.md) | Contexto, diagrama alvo e inventário comando/query. |
| [`2026-05-16_dupply-backend-v1-plan.md`](2026-05-16_dupply-backend-v1-plan.md) | Visão de produto v1. |
| [`2026-05-18_v1-duplicata-contract-integration-architecture.md`](2026-05-18_v1-duplicata-contract-integration-architecture.md) | Fluxo duplicata + contrato. |

---

## 9. Documentação oficial (contexto teórico)

- CQRS — https://martinfowler.com/bliki/CQRS.html  
- Padrão CQRS (Microsoft) — https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs  
- DDD Reference — https://www.domainlanguage.com/ddd/reference/  

Legenda de **esforço:** S = pequeno (&lt; 1 dia), M = médio (1–2 dias), L = vários dias / vários PRs.
