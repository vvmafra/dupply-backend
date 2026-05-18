# Decisões de arquitetura — dupply-backend

Registo curto de decisões que afetam o desenho do repositório. Detalhe e fases de migração: ver links em cada entrada.

---

## 2026-05-19 — CQRS leve e monólito modular na API

**Decisão:** Evoluir o serviço em [`api/`](api/) para **CQRS leve** (comandos vs consultas explícitos na camada de aplicação) e **monólito modular** com bounded contexts **Rampa** (Etherfuse) e **Duplicata** (Soroban), sem Event Sourcing nem read database separado na fase inicial.

**Ports e repositórios:** Introduzir interfaces de persistência (**ports**) e implementações Drizzle (**infrastructure**) na **Fase 5** do plano de implementação, depois de extrair handlers HTTP para `application/`.

**Referências:**

- Regras normativas: [`docs/ARCHITECTURE-RULES.md`](docs/ARCHITECTURE-RULES.md)  
- Plano de implementação (fases / PRs): [`docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md`](docs/notes/2026-05-19_ddd-cqrs-implementation-plan.md)  
- Avaliação inicial: [`docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md`](docs/notes/2026-05-18_backend-ddd-cqrs-assessment.md)  
