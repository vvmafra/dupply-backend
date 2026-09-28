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

Rules live in `.cursor/rules/<name>.mdc`. Cursor attaches them by `globs`; here
`.claude/hooks/inject-cursor-rules.mjs` does the same — the `alwaysApply` rules load at session
start, and a glob-matched rule loads the first time you read or edit a file it covers (once per
session). If a rule has not shown up, read it with `cat .cursor/rules/<name>.mdc`.

Rule-to-area map:

| Working on | Load rule |
|------------|-----------|
| `src/modules/receivable/` | `module-receivables` |
| `src/modules/registry/` (trade-bill HTTP `/v1/trade-bills`, domain `tradeBill/`) | `module-registry` |
| `src/modules/ramp/`, `src/infra/gateways/providers/etherfuse/` | `module-ramp` |
| `src/modules/account/`, `src/modules/auth/` | `module-account` |
| `src/modules/seller/` | `module-seller` |
| `src/modules/wallet/` | `module-wallet` |
| `src/modules/payer/` | `module-payer` |
| `src/infra/database/`, any migration, new DB table | `data-models-relationships` |
| Any `src/` file | `architecture-layers` (modular architecture) |
| Any file in the project | `project-context` |

---

## Rules index (`.cursor/rules/`)

| File | Scope | Covers |
|------|-------|--------|
| `project-context.mdc` | always | Stack, bounded contexts, authoritative docs |
| `architecture-layers.mdc` | `src/**/*` | Modular layout, layers inside modules, import matrix, CQRS |
| `module-*.mdc` | `src/modules/{name}/**` | Per-module schema, routes, invariants |
| `data-models-relationships.mdc` | `src/infra/database/**` | Schema, tables, relationships |

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
- Read `docs/ARCHITECTURE-RULES.md` before any structural change (modular modules + infra).
- Module `domain/` must stay pure — no Fastify, Drizzle, or `process.env`.
- Vendor SDKs only under `src/infra/gateways/providers/` (or blockchain adapters) — modules use ports via `AppDeps`.
- New env vars → `src/infra/env/config.ts` + `.env.example` + `API.md`.
- Schema changes → `src/infra/database/schema.ts` + `npm run db:generate`.
- `src/plugins/` stays at root (global HTTP cross-cutting). `src/shared/` stays at root (pure helpers).
