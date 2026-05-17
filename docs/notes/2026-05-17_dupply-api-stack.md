# Notas: stack da API Dupply (`api/`)

**Data:** 2026-05-17  
**Objetivo:** registar decisões da primeira implementação executável do plano [2026-05-16_dupply-backend-v1-plan.md](2026-05-16_dupply-backend-v1-plan.md).

## Decisões

| Área | Escolha | Motivo |
|------|---------|--------|
| Framework | Fastify 5 | Leve, schema-friendly, logging integrado |
| Linguagem | TypeScript (ESM, `NodeNext`) | Alinhado com manutenção e tipos Zod |
| Persistência (dev) | SQLite + Drizzle ORM | Zero infra local; migrações versionadas em `api/drizzle/` |
| Rampa | Cliente HTTP Etherfuse | Documentação oficial [docs.etherfuse.com](https://docs.etherfuse.com/overview); auth **sem** prefixo `Bearer` |
| Auth API | Header `X-Dupply-Api-Key` | Evita colisão semântica com `Authorization` usado pela Etherfuse |
| Webhook | `canonicalize` + HMAC-SHA256 | Conforme [Verifying Webhooks](https://docs.etherfuse.com/guides/verifying-webhooks); `require` CJS por interoperabilidade de tipos TS |

## Rollback

Remover ou desativar o serviço `api/` não afeta contrato nem indexador; base de dados é ficheiro local (`DATABASE_URL`).

## Próximos passos sugeridos

- PostgreSQL em staging/produção (mesmo schema Drizzle, dialect `postgresql`).  
- `GET /v1/ramp/orders/:id` opcionalmente refrescar estado na Etherfuse (endpoint de listagem/detalhe, quando integrado).  
- Fila (BullMQ) para retries de webhook e reconciliação.
