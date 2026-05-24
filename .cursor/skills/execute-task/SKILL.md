---
name: execute-task
description: >-
  Execute a single task file for dupply-backend end-to-end.
  Reads PRD + techspec + N_task.md, implements, runs checks, marks done.
  Use when: "execute task N for X", "implement task N", "run task N for X".
---

# execute-task

## When to use

Triggered by: "execute task N for X", "implement task N for X", "run task N"

Must run **after** `create-tasks`. Requires `prd.md`, `techspec.md`, and `N_task.md` to exist.

---

## Steps

### 1. Load context (mandatory — do not skip)

1. **Read `tasks/prd-{name}/prd.md`** — goals and functional requirements.
2. **Read `tasks/prd-{name}/techspec.md`** — architecture, component design, code snippets, test strategy.
3. **Read `tasks/prd-{name}/{N}_task.md`** — requirements, subtasks, success criteria.
4. Check dependencies: verify that all tasks listed in "Depends on" are marked `[x]` in `tasks.md`. If not, stop and notify the user.

### 2. Explore before editing

Before modifying any file:
- Read the files listed in "Relevant files" of the task.
- Understand existing patterns (naming conventions, import style, error types, test structure).
- Do not invent patterns — follow what is already in `src/`.

### 3. Implement

Follow the techspec exactly. For each subtask in `N_task.md`:
- Implement the change.
- Write or update tests as specified.
- Follow the architecture rules:
  - `domain/` → no Fastify, Drizzle, `process.env`.
  - New env vars → `config.ts` + `.env.example`.
  - New DB tables/columns → `schema.ts` + `npm run db:generate`.

### 4. Verify

Run the checks in the task's "Success criteria":

```bash
npm run lint     # TypeScript type check
npm test         # Unit tests
```

Fix any errors before proceeding.

### 5. Mark done and create evidence

1. Mark the task `[x]` in `tasks/prd-{name}/tasks.md`.
2. Create `tasks/prd-{name}/{N}_validation-evidence.md`:

```markdown
# Validation evidence — Task {N}.0: {Title}

## Changes made

- File 1: what changed and why
- File 2: what changed and why

## Test results

\`\`\`
npm run lint → ✅ 0 errors
npm test → ✅ N passing
\`\`\`

## Success criteria

- [x] Criterion 1 — how verified
- [x] Criterion 2 — how verified

## Notes

Any deviations from the techspec and why.
```

### 6. Announce

Tell the user:
- What was implemented.
- Lint and test results.
- Next task to run (or that all tasks are complete).

---

## Rules

- Never skip step 1 (reading PRD + techspec). The `<critical>` tag in task files is a hard requirement.
- Do not implement more than the task scope — if you notice a gap, note it in the validation evidence under "Notes" and stop.
- If a techspec decision conflicts with reality (e.g. a file has a different structure than expected), implement the correct approach and document the deviation in the evidence file.
- Always run `npm run lint` before marking a task done.
- Do not commit code — the user drives git.
