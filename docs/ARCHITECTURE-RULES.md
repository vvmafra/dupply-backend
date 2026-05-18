# Regras de arquitetura — `dupply-backend` / serviço `api/`

**Objetivo:** contrato de engenharia para evolução do backend em direção a **DDD** (domínios claros) e **CQRS leve** (comandos vs consultas), sem prescricao de ferramentas desnecessárias.  
**Contexto:** ver nota `[docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md](notes/2026-05-18_backend-ddd-cqrs-assessment.md)`.  
**Âmbito:** código em `api/src/` (Fastify, Drizzle, integrações Etherfuse e Soroban). Contrato Rust e `contracts/` seguem as regras do próprio crate.

---

## 1. Princípios (ordem de prioridade)

1. **Fronteiras explícitas** entre **Rampa** (Etherfuse) e **Duplicata** (registry Soroban): pastas, nomes e imports não devem misturar regras de um contexto no outro sem um caso de uso claro.
2. **Dependências apontam para dentro:** camadas externas dependem das internas; `domain` **não** importa Fastify, Drizzle nem `integrations` (exceto tipos puros se inevitável — evitar).
3. **Integrações são ACL** (*anti-corruption layer*): adaptam APIs terceiras (HTTP Etherfuse, RPC Soroban) ao que o domínio/caso de uso precisa.
4. **CQRS como disciplina:** tudo o que **muda estado** é tratado como **comando**; tudo o que **só lê** é **consulta**. Mesmo antes de existir pastas `commands/` / `queries/`, o nome do fluxo e o ficheiro devem deixar isso óbvio.

---

## 2. Camadas e dependências


| Camada                                                           | Responsabilidade                                           | Regras                                                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **HTTP** (`routes/`, `plugins/`, `server.ts`)                    | Transporte, auth, validação de formato (Zod), status codes | **Obrigatório:** rotas **finas** — sem orquestração longa (> ~50 linhas por handler). **Proibido:** regras de negócio que não sejam tradução de erro ou parse.           |
| **Application** (`application/` quando existir)                  | Casos de uso: orquestrar domínio + ports + transações      | **Obrigatório:** novos fluxos mutáveis passam por aqui. **Recomendado:** um handler por caso de uso (`CreateRampQuote`, `ConfirmDuplicataTx`, …).                        |
| **Domain** (`domain/`)                                           | Invariantes, linguagem ubíqua, agregados/serviços          | **Obrigatório:** validações que definem “o que é válido” para Dupply/contrato. **Proibido:** SQL, cliente HTTP, env direto (passar valores já resolvidos).               |
| **Integrations** (`integrations/`)                               | Clientes externos, assinaturas webhook, parsing bruto      | **Obrigatório:** isolamento de SDKs e URLs. **Proibido:** conhecer detalhes de schema HTTP público Dupply (isso fica em `routes` + Zod).                                 |
| **Infrastructure** (`db/`, futuro `infrastructure/persistence/`) | Drizzle, migrações, implementação de repositórios          | **Obrigatório:** única fonte de verdade de schema em `schema.ts` (+ migrações). **Recomendado:** repositórios por agregado/tabela quando a camada `application` existir. |
| **Generated** (`generated/`)                                     | Bindings Soroban                                           | **Proibido:** editar à mão exceto ajustes documentados no README (regenerar a partir do Wasm).                                                                           |


**Direção permitida de imports (resumo):**

`routes` → `application` → `domain` → *(nada abaixo)*  
`routes` / `application` → `integrations`, `db` *(até haver ports, imports diretos a `db` ficam na application ou routes — migrar para ports quando introduzidos)*  
`domain` → **não** → `integrations`, `db`, `fastify`

### 2.1 Quem pode falar com quem

Legenda: **Sim** = import ou chamada permitidos. **Evitar** = só dívida legada ou exceção documentada; não expandir. **Não** = proibido por estas regras.

Matriz **camada chama camada** (linha = quem chama, coluna = quem é chamado):

| Chama ↓ / Chamado → | HTTP (routes, plugins) | Application | Domain | Integrations | Infrastructure (`db/`, repos) | `generated/` | `config` |
| ------------------- | ---------------------- | ----------- | ------ | ------------ | ------------------------------- | ------------ | -------- |
| **HTTP**            | — (mesmo módulo)       | Sim         | Sim¹   | Evitar²      | Evitar²                         | Evitar³      | Sim      |
| **Application**     | **Não**                | —           | Sim    | Sim          | Sim                             | Sim⁴         | Sim      |
| **Domain**          | **Não**                | **Não**     | —⁵     | **Não**      | **Não**                         | Evitar⁶      | **Não**  |
| **Integrations**    | **Não**                | **Não**     | **Não**| —⁷           | **Não**                         | Sim⁴         | **Não**⁸ |
| **Infrastructure** | **Não**                | **Não**     | **Não**| **Não**      | —                               | **Não**      | **Não**⁸ |

¹ **HTTP → Domain:** apenas validação, tipos e funções puras (ex.: Zod + `validateIssueInvariants`). Sem I/O.  
² **HTTP → Integrations / db:** permitido no código legado; novos fluxos devem passar por **Application** (ou handler dedicado equivalente).  
³ **HTTP → generated:** evitar; preferir passar pelo fluxo registry/application.  
⁴ **Application / Integrations → generated:** bindings do contrato Soroban; uso concentrado em integração registry + casos de uso duplicata.  
⁵ **Domain → Domain:** imports entre módulos do mesmo contexto (`duplicata/*`) permitidos; manter acíclico.  
⁶ **Domain → generated:** evitar; preferir tipos próprios do domínio e mapear na borda (application ou `map-issue-payload`).  
⁷ **Integrations → Integrations:** apenas auxiliares partilhados na mesma pasta (ex.: `stellar/network` usado por `registry`); **não** importar `etherfuse` a partir de `registry` nem o inverso.  
⁸ **Integrations / Infrastructure → config:** valores já injetados pelo compositor (`server` / factory de handlers); **não** ler `process.env` dentro de `integrations` ou `db`.

**Bounded contexts (Rampa vs Duplicata):**

| Origem | Destino | Regra |
| ------ | ------- | ----- |
| Código sob `routes/v1/ramp`, `integrations/etherfuse`, futuro `domain/ramp` | `domain/duplicata`, `integrations/registry` | **Não** acoplar (sem imports cruzados). Exceção: infra partilhada (`db`, `config`, util genérico sem regra de negócio). |
| Código sob duplicata (`routes` duplicatas, `domain/duplicata`, `integrations/registry`) | `integrations/etherfuse`, futuro `domain/ramp` | **Não** acoplar. |

**Resumo em uma frase:** só **HTTP** e **Application** tocam o mundo exterior (HTTP, BD, clientes); **Domain** só regras e tipos; **Integrations** só protocolos externos; **Infrastructure** só persistência e migrações.

---

## 3. CQRS

- **Comando:** cria ou altera dados persistidos, chama side-effect externo mutável (criar quote/order, simular `issue`, confirmar tx, aplicar webhook). Deve ser **nomeado** no imperativo (`CreateRampOrder`, não `handlePost`).  
- **Consulta:** apenas lê BD ou serviços externos de leitura; **sem** `insert`/`update`/`delete` nem efeitos colaterais observáveis (exceto logs/métricas).  
- **Recomendado:** ficheiros ou pastas separados `commands` vs `queries` quando se tocar num módulo em refactor.  
- **Permitido:** partilhar o mesmo modelo físico de BD entre leitura e escrita na fase atual; read models / views só quando houver requisito de performance ou relatórios.

---

## 4. Bounded contexts


| Contexto      | Código típico hoje                                            | Regra                                                                                                                      |
| ------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Ramp**      | `routes/v1/ramp.ts`, `integrations/etherfuse`, webhook        | Novas regras de rampa entram em `domain/ramp` (quando criado) ou em handler de application, **não** em `domain/duplicata`. |
| **Duplicata** | `domain/duplicata`, `integrations/registry`, rotas duplicatas | IDs, enums e hashes alinhados ao contrato; mudanças coordenadas com `contracts/duplicata-registry`.                        |


**Correlação rampa ↔ duplicata** (futuro): apenas via **IDs explícitos** na BD ou eventos — sem acoplamento temporal em código (sem “chamar ramp ao confirmar duplicata” sem caso de uso documentado).

---

## 5. Persistência (Drizzle)

- **Obrigatório:** alterações de schema via `schema.ts` + migração gerada/revisada; não alterar só a BD à mão em ambientes partilhados.  
- **Recomendado:** transações (`db.transaction`) quando um comando tocar em **duas ou mais** linhas que devem ser atómicas.  
- **Proibido:** strings SQL ad hoc no serviço salvo exceção justificada (relatórios) e documentada.

---

## 6. API HTTP e contratos

- **Obrigatório:** validação de entrada com Zod (ou equivalente) na borda HTTP.  
- **Obrigatório:** erros de domínio mapeados para 4xx/5xx **num sítio** por contexto (função `mapXxxError` ou middleware), não espalhar `reply.code` por dezenas de ramos iguais sem necessidade.  
- **Recomendado:** manter compatibilidade de JSON nas rotas `/v1/*` documentadas; mudanças quebrantes exigem nova versão (`/v2`) ou changelog explícito.  
- **Proibido:** expor secrets, JWT completos ou chaves em respostas/logs.

---

## 7. Configuração e segredos

- **Obrigatório:** novas variáveis em `config.ts` + `.env.example` + menção no `api/README.md` se forem operacionais.  
- **Proibido:** `process.env` espalhado fora de `config` (exceto testes).

---

## 8. Testes

- **Recomendado:** testes unitários em **domain** e **application** (handlers) sem subir servidor HTTP.  
- **Recomendado:** integrações com Etherfuse/Soroban atrás de interfaces ou fakes em CI; smoke manual/script mantido para sandbox.  
- **Obrigatório:** regressão em `cargo test` do contrato quando o fluxo duplicata depender de mudanças no Wasm.

---

## 9. Dívida legítima (grandfathering)

Código existente em `routes/v1/*.ts` com Drizzle e orquestração inline **não viola** estas regras até ser tocado; ao **alterar** um handler significativamente, **deve** aproximar-se das regras (extrair comando/consulta ou port).

---

## 10. Checklist rápido (PR)

- O PR identifica o bounded context (Ramp / Duplicata / Infra partilhada)?  
- Mutações estão claras como comando e leituras como consulta?  
- `domain` não ganhou imports de Fastify/Drizzle/cliente HTTP?  
- `.env.example` / `config` atualizados se houver nova config?  
- Documentação pública (`README` ou `docs/notes`) atualizada se o comportamento observável mudou?

---

## Referências

- Plano de implementação (fases e PRs): [`docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md`](notes/2026-05-19_ddd-cqrs-implementation-plan.md)  
- Avaliação DDD+CQRS deste repo: [`docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md`](notes/2026-05-18_backend-ddd-cqrs-assessment.md)  
- CQRS (visão geral): [martinfowler.com/bliki/CQRS.html](https://martinfowler.com/bliki/CQRS.html)  
- Padrão CQRS (Microsoft): [learn.microsoft.com/en-us/azure/architecture/patterns/cqrs](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)  
- DDD Reference: [domainlanguage.com/ddd/reference](https://www.domainlanguage.com/ddd/reference/)

