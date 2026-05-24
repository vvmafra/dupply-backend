---
name: write-prd
description: >-
  Write a structured PRD for a dupply-backend feature.
  Creates tasks/prd-{name}/prd.md following the project template.
  Use when: "write PRD for X", "create PRD for X", "prd X".
---

# write-prd

## When to use

Triggered by: "write PRD for X", "create PRD for X", "PRD for X"

Use this skill at the **start of every feature** — before writing any code, techspec, or tasks.

---

## Steps

### 1. Gather context

Before writing anything:

1. Read `AGENTS.md` for bounded context routing.
2. Read the relevant `.cursor/rules/` file for the domain being affected (e.g. `receivable-workflows`, `data-models-relationships`).
3. Read `docs/ARCHITECTURE-RULES.md` (layers, CQRS constraints).
4. Ask for any missing information:
   - **Feature name** (kebab-case, e.g. `receivable-audit-log`) — used for the folder name.
   - **Description** — what the feature does and why it's needed.
   - Any open business questions you cannot infer from existing docs.

### 2. Create the PRD file

Create `tasks/prd-{name}/prd.md` using the template below.

Fill in every section. If a section is unknown, mark it explicitly as **TBD** or **Open Question** — do not leave it blank or invent requirements.

### 3. Announce and suggest next step

After creating the file, tell the user:
- What was created and where.
- That the next step is `write-techspec` (`"write techspec for {name}"`).

---

## PRD template

```markdown
# Product Requirements Document — {Feature Title}

## Overview

One or two paragraphs. What is this feature? Why is it needed now?
Reference any relevant existing behavior this feature changes or extends.

## Goals

- Goal 1
- Goal 2

**Success metrics:**
- Metric 1 (e.g. "100% of confirmed receivables emit an audit log entry")
- Metric 2

## User Stories

- As a {role}, I want to {action} so that {benefit}.
- As a {role}, I want to {action} so that {benefit}.

**Main flow:**
1. Step 1
2. Step 2
3. Step 3

## Core Features

1. **Feature name**
   - What it does: ...
   - Why it matters: ...

2. **Feature name**
   - What it does: ...
   - Why it matters: ...

## Functional Requirements

1. FR-1: ...
2. FR-2: ...
3. FR-3: ...

_(Use numbered IDs so techspec and tasks can reference them.)_

## Technical Constraints

- Scope: backend only (`src/`), no frontend changes.
- No new tables / migrations required. _(or: migration required — describe.)_
- Must preserve existing API contract on `/v1/...`.
- Details of algorithm and layer design will be defined in the Tech Spec.

## Out of Scope

- Item 1
- Item 2

## Open Questions

- Question 1 — who owns the answer?
- Question 2 — who owns the answer?
```

---

## Rules

- English only. No Portuguese in the PRD file.
- Functional requirements must be numbered (`FR-N`). TechSpec and task files will reference these IDs.
- Do not include implementation details (layer choices, file names, code snippets) — that belongs in the TechSpec.
- Keep "Technical Constraints" at a product level only (no code).
- `tasks/prd-{name}/` folder must be created if it does not exist.
