# Dupply Backend — Agent Guide

Fastify HTTP API + Soroban smart contract for the Dupply receivables/trade-bill platform.
Stack: Node 20, TypeScript ESM, Fastify 5, Drizzle ORM, SQLite (dev) / PostgreSQL (prod), Stellar/Soroban.

---

## Development workflow

Every feature follows this pipeline. Each step has a dedicated skill:

```
PRD  →  TechSpec  →  Tasks  →  Execute (task by task)
```

| Step | Trigger phrase | Skill | Output |
|------|---------------|-------|--------|
| 1 | "write PRD for X" | `write-prd` | `tasks/prd-{name}/prd.md` |
| 2 | "write techspec for X" | `write-techspec` | `tasks/prd-{name}/techspec.md` |
| 3 | "create tasks for X" | `create-tasks` | `tasks/prd-{name}/tasks.md` + `N_task.md` |
| 4 | "execute task N for X" | `execute-task` | Code changes + `N_validation-evidence.md` |

All artifacts live under `tasks/prd-{kebab-name}/`. Never start coding without a PRD + techspec.

---

## Context routing

Load the relevant rule before working in an area:

| Working on | Load rule |
|------------|-----------|
| `src/domain/receivable/`, `routes/v1/receivables*`, `receivable-internal*` | `receivable-workflows` |
| `src/domain/tradeBill/`, `routes/v1/trade-bills*`, `integrations/registry/` | `trade-bill-workflows` *(coming soon)* |
| `src/routes/v1/ramp*`, `integrations/etherfuse/` | `ramp-integration` *(coming soon)* |
| `src/db/schema.ts`, any migration, new DB table | `data-models-relationships` |
| Any `src/` file | `architecture-layers` |
| Any file in the project | `project-context` |

---

## Rules index (`.cursor/rules/`)

| File | Scope | Covers |
|------|-------|--------|
| `project-context.mdc` | always | Stack, bounded contexts, authoritative docs |
| `architecture-layers.mdc` | `src/**/*` | DDD layers, CQRS, import matrix |
| `receivable-workflows.mdc` | receivable paths | Status machine, RBAC, domain rules |
| `data-models-relationships.mdc` | `src/db/**` | Schema, tables, relationships |

---

## Skills index (`.cursor/skills/`)

| Folder | Purpose |
|--------|---------|
| `write-prd/` | Produce a structured PRD for a feature |
| `write-techspec/` | Produce a tech spec from a PRD |
| `create-tasks/` | Break techspec into atomic task files |
| `execute-task/` | Implement one task file end-to-end |

---

## Quick rules

- English for all code, APIs, DB columns, technical docs, task files, and rule files.
- Read `docs/ARCHITECTURE-RULES.md` before any structural change.
- `domain/` must stay pure — no Fastify, Drizzle, or `process.env`.
- New env vars → `config.ts` + `.env.example` + `API.md`.
- Schema changes → `schema.ts` + `npm run db:generate`.
