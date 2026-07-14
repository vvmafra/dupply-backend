# Task 8.0: Governance sync — docs, rules, and agent skills

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Updates all architecture documentation, Cursor rules, and agent skills so future human and AI contributions follow the modular layout. Rewrites `ARCHITECTURE-RULES.md` with the import matrix; updates `AGENTS.md` context routing; refreshes every affected `.cursor/rules/*.mdc` and skill file to reference `src/modules/` and `src/infra/` paths.

Corresponds to **techspec §8 Governance updates** and **PRD FR-19–FR-28**.

Depends on: **7.0**

## Requirements

- FR-19: Rewrite `docs/ARCHITECTURE-RULES.md` for modular layout, import matrix, CQRS conventions inside modules
- FR-20: Update `AGENTS.md` context routing table to `src/modules/{name}/` and `src/infra/`
- FR-21: Update `.cursor/rules/project-context.mdc` — remove legacy horizontal-layer paths as canonical
- FR-22: Rewrite `.cursor/rules/architecture-layers.mdc` as modular architecture rule (layers inside modules + infra boundaries)
- FR-23: Update all module-specific rule files (`module-account.mdc`, `module-wallet.mdc`, `module-seller.mdc`, `module-payer.mdc`, `module-receivables.mdc`, `module-registry.mdc`, `module-ramp.mdc`) — `globs` and path references
- FR-24: Review and update `.cursor/rules/routes-swagger.mdc` and `.cursor/rules/testing.mdc` if they reference legacy paths
- FR-25: Update `.cursor/skills/write-prd/SKILL.md` — require reading updated architecture rule; use `src/modules/` examples
- FR-26: Update `.cursor/skills/write-techspec/SKILL.md` — explore `src/modules/{context}/` and `src/infra/`
- FR-27: Update `.cursor/skills/create-tasks/SKILL.md` and `.cursor/skills/execute-task/SKILL.md` — reference modular architecture rule
- FR-28: Ensure `src/infra/gateways/README.md` exists and is complete (may have been created in Task 1 — verify and extend if needed)
- FR-6: Document that `src/plugins/` stays at repo root (global HTTP cross-cutting, not vendor infra)
- FR-8: `npm run lint` and `npm test` still pass (no code regressions from doc-only changes)

## Subtasks

- [x] 8.1 Read current `docs/ARCHITECTURE-RULES.md`, `AGENTS.md`, and all affected `.cursor/rules/*.mdc` files
- [x] 8.2 Rewrite `docs/ARCHITECTURE-RULES.md` with modular layout, import matrix from techspec § Import matrix, and updated path examples
- [x] 8.3 Update `AGENTS.md` context routing table
- [x] 8.4 Update `.cursor/rules/project-context.mdc` and `.cursor/rules/architecture-layers.mdc`
- [x] 8.5 Update module-specific rules: `module-account.mdc`, `module-wallet.mdc`, `module-seller.mdc`, `module-payer.mdc`, `module-receivables.mdc`, `module-registry.mdc`, `module-ramp.mdc` — set `globs` to `src/modules/{name}/**`
- [x] 8.6 Review and update `routes-swagger.mdc` and `testing.mdc` example paths
- [x] 8.7 Update agent skills: `write-prd`, `write-techspec`, `create-tasks`, `execute-task`
- [x] 8.8 Verify `src/infra/gateways/README.md` is complete (ports vs providers vs factories; how to add chain/vendor)
- [x] 8.9 Final verification: `npm run lint` && `npm test`

## Implementation details

Reference **techspec §8 Governance updates** and **Import matrix** table.

Key artifacts and actions:

| Artifact | Action |
| -------- | ------ |
| `docs/ARCHITECTURE-RULES.md` | Rewrite §2 layers for modular layout + import matrix |
| `AGENTS.md` | Context routing → `src/modules/{name}/`, `src/infra/` |
| `.cursor/rules/project-context.mdc` | Replace legacy path table |
| `.cursor/rules/architecture-layers.mdc` | Modular architecture — layers apply inside modules |
| `module-*.mdc` | Update `globs` to `src/modules/{name}/**` |
| `routes-swagger.mdc`, `testing.mdc` | Update example paths |
| `.cursor/skills/write-prd/SKILL.md` | Read updated architecture rule; `src/modules/` examples |
| `.cursor/skills/write-techspec/SKILL.md` | Explore `src/modules/{context}/`, `src/infra/` |
| `.cursor/skills/create-tasks/SKILL.md`, `execute-task/SKILL.md` | Reference modular architecture rule |

Document resolved open questions in architecture docs:

- OQ-1: `src/shared/` stays at root
- OQ-4: `src/plugins/` stays at root
- OQ-2: module = `registry`, domain folder = `tradeBill/`

English for all updated rules, skills, and architecture docs.

## Success criteria

- [x] `docs/ARCHITECTURE-RULES.md` describes modular layout with import matrix — no legacy horizontal-layer examples as canonical
- [x] `AGENTS.md` routes each bounded context to `src/modules/{name}/`
- [x] All module rule `globs` match new paths
- [x] Agent skills require reading modular architecture rule before PRD/techspec/task work
- [x] `src/infra/gateways/README.md` documents how to add a new chain or vendor
- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-src-modular-architecture/prd.md` ← read first
- `tasks/prd-src-modular-architecture/techspec.md` ← read first
- `docs/ARCHITECTURE-RULES.md` ← rewrite
- `AGENTS.md` ← modify
- `.cursor/rules/project-context.mdc` ← modify
- `.cursor/rules/architecture-layers.mdc` ← rewrite
- `.cursor/rules/module-*.mdc` ← modify globs and paths
- `.cursor/rules/routes-swagger.mdc` ← review/update
- `.cursor/rules/testing.mdc` ← review/update
- `.cursor/skills/write-prd/SKILL.md` ← modify
- `.cursor/skills/write-techspec/SKILL.md` ← modify
- `.cursor/skills/create-tasks/SKILL.md` ← modify
- `.cursor/skills/execute-task/SKILL.md` ← modify
- `src/infra/gateways/README.md` ← verify/extend
