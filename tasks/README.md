# Tasks

Feature artifacts for dupply-backend. Each folder corresponds to one feature and follows the pipeline:

```
PRD  →  TechSpec  →  Tasks  →  Execute
```

## Folder structure

```
tasks/
  prd-{feature-name}/
    prd.md                    ← product requirements (write-prd skill)
    techspec.md               ← technical spec (write-techspec skill)
    tasks.md                  ← task checklist (create-tasks skill)
    1_task.md                 ← task 1 details
    2_task.md                 ← task 2 details
    N_task.md                 ← ...
    N_validation-evidence.md  ← evidence after executing task N
```

## Usage

| What you want | Say to the agent |
|---------------|-----------------|
| Start a feature | `"write PRD for {feature description}"` |
| Write the tech spec | `"write techspec for {name}"` |
| Create task breakdown | `"create tasks for {name}"` |
| Implement a task | `"execute task {N} for {name}"` |

## Features

_(add entries as features are created)_

| Folder | Status | Description |
|--------|--------|-------------|
| `prd-account-module` | PRD done | Replace `platform_users` with `accounts`; auth (register/login/refresh/logout) + account CRUD |
