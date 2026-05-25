# Task 2.0: API docs and module-account rule updates

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Documents the new `GET /v1/accounts/me` endpoint in `API.md` and adds it to the planned routes table in `.cursor/rules/module-account.mdc`. This completes discoverability beyond Swagger (FR-9) and resolves PRD open questions OQ-1 and OQ-2.

Corresponds to **techspec § Component 3 — Documentation updates**.

Depends on: **1.0**

## Requirements

- FR-9: Route documented for frontend and external integrators (Swagger handled in task 1.0; this task covers `API.md` and cursor rules)
- OQ-1 (resolved): Update `API.md` in the same feature
- OQ-2 (resolved): Add `/me` row to `.cursor/rules/module-account.mdc` planned routes table
- Techspec: Document that `/me` is an authenticated alias returning the same response as `GET /v1/accounts/:id` when `:id` = JWT `sub`

## Subtasks

- [ ] 2.1 Read `API.md` Accounts section to understand existing route documentation format
- [ ] 2.2 Read `.cursor/rules/module-account.mdc` planned routes table
- [ ] 2.3 Add `GET /v1/accounts/me` entry to `API.md` under Accounts
- [ ] 2.4 Add row to planned routes table in `module-account.mdc`
- [ ] 2.5 Verify documentation accurately reflects implemented behavior from task 1.0

## Implementation details

Reference **techspec § "3. Documentation updates"**.

| File | Change |
|------|--------|
| `API.md` | Add `GET /v1/accounts/me` under the Accounts section — authenticated alias for the caller's own account; same response as `GET /v1/accounts/:id` when `:id` = JWT `sub`. |
| `.cursor/rules/module-account.mdc` | Add row to planned routes table: `GET \| /v1/accounts/me \| JWT \| Lê a conta do actor autenticado (alias)`. |

Match the tone and format of existing entries in both files. Do not document out-of-scope items (aggregated `/v1/me`, PATCH/DELETE aliases, `profileId` in response).

## Success criteria

- [ ] `API.md` lists `GET /v1/accounts/me` with auth requirement and response description
- [ ] `module-account.mdc` routes table includes the `/me` row
- [ ] Documentation is consistent with implemented route behavior from task 1.0
- [ ] No unrelated documentation changes

## Relevant files

- `tasks/prd-account-me-route/prd.md` ← read first
- `tasks/prd-account-me-route/techspec.md` ← read first
- `API.md` ← modify
- `.cursor/rules/module-account.mdc` ← modify
