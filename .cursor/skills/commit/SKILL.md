---
name: commit
description: >-
  Stage, commit and push changes in dupply-backend following Conventional Commits.
  Use when: "commit", "fazer commit", "commit and push", or when the user invokes
  the commit skill.
disable-model-invocation: true
---

# commit

## When to use

Triggered by: "commit", "fazer commit", "commit and push", or invoking the `/commit` skill.

Runs the full workflow: confirm branch → review changes → stage → commit → push.

---

## Workflow

### 1. Confirm branch (mandatory — stop here first)

Run in parallel:

```bash
git branch --show-current
git status -sb
```

**Tell the user the current branch and tracking status before doing anything else.**

Example output to the user:

> Branch atual: `feat/roles-guard` (ahead 2 / behind 0 vs `origin/feat/roles-guard`)

If there are no changes to commit (clean working tree), stop and tell the user.

If on `main` or `master` with uncommitted work, warn the user and ask whether to proceed before continuing.

### 2. Review changes

Run in parallel:

```bash
git status
git diff
git diff --staged
git log --oneline -10
```

Analyze all changes (staged and unstaged) to determine:
- **type** — what kind of change this is
- **module** — which bounded context or area is affected
- **message** — concise description in English, imperative mood

Do **not** commit files that likely contain secrets (`.env`, credentials, keys). Warn the user and exclude them from staging.

### 3. Stage

```bash
git add .
```

If secrets were detected, stage only safe files instead of `git add .`.

### 4. Commit

Use Conventional Commits with this structure:

```
type(module): short description in English
```

**Types:**

| type | when |
|------|------|
| `feat` | new feature or capability |
| `fix` | bug fix |
| `refactor` | code change without behavior change |
| `test` | tests only |
| `docs` | documentation only |
| `chore` | tooling, deps, CI, config |

**Modules** (pick the most specific one):

`account`, `seller`, `wallet`, `payer`, `receivable`, `documents`, `registry`, `ramp`, `risk-analyst`, `auth`, `api`, `deploy`, `arch`

Use `api` for cross-cutting HTTP/routes changes; `arch` for structural/layering changes; `deploy` for Render/CI/build.

**Examples from this repo:**

```
feat(api): platform JWT auth, receivables v1, Etherfuse KYC, Postgres schema
fix(deploy): emit dist/server.js for Render start command
refactor(arch): registry config slice and trade-bill mapper in application
feat(account): added new modulo account to auth and minor fixes
```

Commit using HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
type(module): description here

EOF
)"
```

If the commit fails due to a pre-commit hook, fix the issue and create a **new** commit — never amend a failed commit.

### 5. Push

```bash
git push
```

If the branch has no upstream, set it:

```bash
git push -u origin HEAD
```

If push is rejected (remote has new commits), run `git pull --rebase` and retry push. Do not force-push unless the user explicitly asks.

### 6. Confirm

Run `git status` and tell the user:
- Branch name
- Commit hash and message
- Push result (remote updated or already up to date)

---

## Rules

- Always show the branch to the user in step 1 before staging or committing.
- Message body is optional — use only when the subject line alone is insufficient.
- Write commit messages in **English**, imperative mood ("add", "fix", "remove" — not "added" or "adds").
- Never update git config.
- Never use `--no-verify`, `--force`, or `git commit --amend` unless the user explicitly requests it.
- This skill **includes push** — that is intentional when the user invokes it.
