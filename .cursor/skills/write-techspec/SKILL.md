---
name: write-techspec
description: >-
  Write a tech spec from an existing PRD for dupply-backend.
  Creates tasks/prd-{name}/techspec.md.
  Use when: "write techspec for X", "techspec for X", "tech spec X".
---

# write-techspec

## When to use

Triggered by: "write techspec for X", "techspec for X", "tech spec X"

Must run **after** `write-prd`. Requires `tasks/prd-{name}/prd.md` to exist.

---

## Steps

### 1. Read context

1. Read `tasks/prd-{name}/prd.md` — all sections, especially Functional Requirements.
2. Read `docs/ARCHITECTURE-RULES.md` — **modular architecture**, import matrix, CQRS. Mandatory.
3. Read the relevant `.cursor/rules/` files for the affected domain (`module-*.mdc`, `architecture-layers.mdc`).
4. Explore the actual source files that will be changed:
   - `src/modules/{context}/` — `api/`, `application/`, `domain/` for the relevant bounded context.
   - `src/infra/` — `env/`, `database/`, `gateways/`, `blockchain/` when config, schema, or vendors are involved.
   - `src/compose/deps.ts` / `registerModules.ts` when wiring new modules or ports.
5. Note existing patterns (naming, error handling, test structure under `tests/modules/`).

### 2. Write the TechSpec

Create `tasks/prd-{name}/techspec.md` using the template below.

Every Functional Requirement (`FR-N`) from the PRD must appear somewhere in the spec — either directly addressed in a component or noted as not requiring a separate implementation note.

### 3. Announce and suggest next step

Tell the user what was created and that the next step is `create-tasks` (`"create tasks for {name}"`).

---

## TechSpec template

```markdown
# Tech Spec — {Feature Title}

## Overview

One paragraph. What is being implemented and what is NOT being implemented (scope boundary).
Reference PRD if useful.

---

## Architecture overview

Describe the modules/infra touched and how layers interact. Use a diagram if the flow is non-trivial:

\`\`\`
Module api/ (HTTP)
  └── Zod + auth + error mapping
Module application/ (command or query)
  └── domain rules + infra/gateways/ports + infra/database
Module domain/
  └── pure invariants
infra/gateways/providers/ (if external)
  └── vendor SDKs
\`\`\`

---

## Component design

### 1. {Component name}

**File:** `src/modules/{context}/...` or `src/infra/...`

What changes and why. Include concrete code snippets:

\`\`\`typescript
// Before (if applicable)
// ...

// After
// ...
\`\`\`

Justify non-obvious decisions.

### 2. {Component name}
...

---

## Data flow

\`\`\`
HTTP request
  → modules/{ctx}/api (Zod)
  → modules/{ctx}/application/commands|queries
      → domain guard / entity method
      → infra/database and/or deps.gateways
  → HTTP response
\`\`\`

---

## Files changed

| File | Change type |
|------|-------------|
| `src/modules/...` or `src/infra/...` | Added / Modified / Deleted |

---

## Impact analysis

- **API compatibility:** breaking or non-breaking?
- **Database:** migration needed? What tables?
- **Performance:** any O(N) concerns?
- **Other modules:** any cross-context impact? (use compose/ports — no cross-domain imports)

---

## Test strategy

### Unit — {subject}

| Scenario | Input | Expected |
|----------|-------|----------|
| ... | ... | ... |

### Integration — {subject}

- Test 1
- Test 2

### API / E2E (if needed)

- Test 1

---

## Observability

- New logs needed? Where and what level?
- Error handling: how does a failure surface to the caller?

---

## Open questions resolved

| Question (from PRD) | Decision |
|---------------------|----------|
| ... | ... |
```

---

## Rules

- English only.
- Every `FR-N` from the PRD must be traceable to at least one component section.
- Include exact file paths under `src/modules/` and `src/infra/` — no vague "somewhere in the service layer".
- Code snippets must compile against the project's TypeScript config (`verbatimModuleSyntax`, ESM).
- Product modules must not import vendor SDKs; depend on `infra/gateways/ports` via `AppDeps`.
- Do not change the PRD. If you discover a conflict, note it in "Open questions resolved" and resolve it inline.
- `tasks/prd-{name}/` must already exist (created by `write-prd`).
