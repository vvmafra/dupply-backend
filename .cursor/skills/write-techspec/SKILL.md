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
2. Read `docs/ARCHITECTURE-RULES.md` — layers, CQRS, import matrix.
3. Read the relevant `.cursor/rules/` files for the affected domain.
4. Explore the actual source files that will be changed:
   - `src/domain/` entities for the relevant context.
   - `src/db/schema.ts` if schema changes are needed.
   - Existing routes, application handlers, integration clients.
5. Note existing patterns (naming, error handling, test structure).

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

Describe the layers touched and how they interact. Use a diagram if the flow is non-trivial:

\`\`\`
Domain (entity / value object)
  └── new method / rule
Application (command or query handler)
  └── orchestrates domain + DB + integration
HTTP (route handler)
  └── thin — only Zod + auth + status code mapping
\`\`\`

---

## Component design

### 1. {Component name}

**File:** `src/path/to/file.ts`

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
  → Zod validation
  → Application handler
      → Domain guard / entity method
      → DB write / read
  → HTTP response
\`\`\`

---

## Files changed

| File | Change type |
|------|-------------|
| `src/...` | Added / Modified / Deleted |

---

## Impact analysis

- **API compatibility:** breaking or non-breaking?
- **Database:** migration needed? What tables?
- **Performance:** any O(N) concerns?
- **Other modules:** any cross-context impact?

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
- Include exact file paths — no vague "somewhere in the service layer".
- Code snippets must compile against the project's TypeScript config (`verbatimModuleSyntax`, ESM).
- Do not change the PRD. If you discover a conflict, note it in "Open questions resolved" and resolve it inline.
- `tasks/prd-{name}/` must already exist (created by `write-prd`).
