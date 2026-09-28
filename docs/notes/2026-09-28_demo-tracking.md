# Demo tracking (single source of truth for both repos)

Read this first in every new session (local or Claude Code cloud). Update it at the end of every
session and after every commit. Plan and rationale: `2026-09-27_demo-week-plan.md`.

## Working agreement (agreed with the founder on 2026-09-28)

- Make everything work **locally first**. The founder does the cloud deploy (Render / Vercel /
  Supabase) later. Do not touch Render, Vercel or Supabase from an agent session.
- Work happens in **Claude Code cloud sessions**; this file is how a new session picks up context.
- Branches: `feat/demo-local` in both repos, cut from `feat/investor-ramp` (backend) and
  `feat/investor` (frontend). Commit and push to the `vvmafra` GitHub account, git identity
  `vvmafra <victorvmafra97@gmail.com>`.
- Gaps are done **in sequence, one commit per gap** (backend and frontend commits are separate).
- Minimum change, evidence via real command output, stop and ask if stuck for more than 30 min.
- Code, APIs and docs in English. Out of scope until the demo: architecture rewrite, Nest
  migration, multi-chain abstraction, offer as its own entity, SQLite → Postgres in dev.
- Database: founder has Postgres locally. Cloud sessions cannot reach it: use SQLite
  (`DATABASE_URL=file:./data/dupply.db`, the repo default) in the cloud, and the founder re-runs
  the smoke on local Postgres (gap 2) before deploying.

## Gap board

| # | Gap | Repo | Status | Commit | Evidence |
|---|-----|------|--------|--------|----------|
| 0 | Offers not showing for investor / admin | backend + frontend | todo | | |
| 1 | Open funding: admin route + admin button | backend + frontend | backend done, frontend todo | backend `6b0a4a3` | session log 2026-09-28 (cloud) |
| 3 | Pay seller / payer settles as admin actions + "advance stage" button | backend + frontend | backend done, frontend todo | backend `a2b23fd` | session log 2026-09-28 (cloud) |
| 2 | Postgres parity smoke (founder, local Postgres) | backend | todo | | |
| 5 | Demo seed: `aiReport`, seller `in_review`, one receivable per stage, investor balance | backend | todo | | |
| 4 | One-command reset + seed, Supabase only with explicit flag | backend | todo | | |
| 6 | Deploy config (founder) | both | not started | | |
| 7 | `statusHistory` on system transitions | backend | only if a screen needs it | | |
| 8 | Seller `createdAt` year 58704 on Postgres | backend | check during gap 2 | | |
| 9 | Balance race | backend | accepted debt | | |

Session scope agreed on 2026-09-28: gaps 0, 1 and 3, in that order.

## Code map for gaps 0, 1 and 3 (verified 2026-09-28)

Backend (`src/modules/receivable`, `src/modules/investor`):

- State machine: `domain/transitions.ts`. `confirmed → funding`, `funding → funded`,
  `funded → processing`, `processing → completed`, `completed → payer_settled | overdue` all
  require `actor.kind === "system"`. There is **no HTTP route** for `confirmed → funding`; only
  `scripts/advance-receivables.ts` does it with a raw update.
- `funding → funded` happens automatically inside `executeInvest` when
  `fundedCents === targetFundingCents`. If the seed leaves `targetFundingCents = 0`, the
  investor can never invest (`INVESTMENT_EXCEEDS_REMAINING_FUNDING`).
- `processing` and `completed` are reachable only through
  `POST /v1/internal/receivables/:id/advance-settlement` (body `{ targetStatus }`), API-key auth.
  `payer_settled` / `overdue` only through `POST /v1/internal/receivables/:id/payer-settlement`
  (body `{ outcome }`), which runs the pro-rata payout in `executeSystemPayerSettlement`.
- `GET /v1/receivables`: investor sees **only** `status = 'funding'`; admin and risk roles see
  everything. This is the first thing to check for gap 0: is there any receivable in `funding`
  with `targetFundingCents > 0` in the DB the frontend is pointed at?
- Role guard: `src/plugins/require-roles.ts` (`requireRoles("admin")`). Roles today:
  seller, payer, admin, risk_analyst, risk_analyst_agent, investor.
- Seed: `scripts/seed-dev.ts` (seller@dupply.dev.local, investor@dupply.dev.local; check the
  file for passwords and for what status the receivables land in).

Frontend (`dupply-frontend/src`):

- `.env`: `VITE_USE_MOCKS=false`, `VITE_API_BASE_URL=http://localhost:8081`.
- `services/admin.service.ts` imports **only mocks** (`MOCK_SELLERS`, `MOCK_RECEIVABLES`,
  `PLATFORM_METRICS`). The admin "ready for offer" list therefore never reflects the backend.
  Second cause of gap 0.
- Other services (`investor.service.ts`, `offer.service.ts`, `receivables.service.ts`) still
  reference mocks somewhere; check the `VITE_USE_MOCKS` branch in each before assuming they hit
  the API.

## Proposed design (small, matches the plan's defaults)

- Gap 1: `POST /v1/admin/receivables/:id/open-funding`, `requireRoles("admin")`. Command
  `adminOpenFundingCommand.ts`: assert `confirmed → funding` with the system actor (admin action
  is the trigger, the transition stays system-only in the domain), set `targetFundingCents` from
  `proposedValue` (fallback `value`) when it is 0, keep `fundedCents`. Test in `tests/`.
  Frontend: one "Open funding" button on the admin receivable row / detail, visible when
  status is `confirmed`.
- Gap 3: `POST /v1/admin/receivables/:id/advance-stage`, `requireRoles("admin")`, no body.
  Maps `funded → processing`, `processing → completed`, `completed → payer_settled` (reusing
  `executeSystemAdvanceSettlement` and `executeSystemPayerSettlement`, so the payout runs).
  Returns `{ from, to }`. Frontend: one "Advance stage" button shown for those three statuses.
  Do not delete the internal API-key routes.
- Gap 0: after the above, seed one receivable in `funding` with a real target and verify
  `GET /v1/receivables` as investor and admin returns it; wire `admin.service.ts` to
  `GET /v1/receivables` when mocks are off.

## Session log

### 2026-09-28 (local session, alignment only, no code changes)

- Agreed the working agreement above. Created `feat/demo-local` in both repos from the pulled
  tips (`c5488b7` backend, `112e4b4` frontend). Set git identity and switched `gh` to `vvmafra`.
- Mapped the code paths listed above. No gap fixed yet.
- Next: cloud session picks up gaps 0 → 1 → 3 on `feat/demo-local`, one commit each, and
  appends to this log.

### 2026-09-28 (cloud session, backend gaps 1 and 3)

Branch `feat/demo-local`, two commits, one per gap. Gap 0 was not touched in this session (it
was scoped to gaps 1 and 3 only); the backend half of gap 0 now depends only on seeding, since
the smoke below shows `GET /v1/receivables` as investor lists a receivable once it is in
`funding` with a real target.

- **Gap 1** (`6b0a4a3`): `POST /v1/admin/receivables/:id/open-funding`, JWT +
  `requireRoles("admin")`, no body. `adminOpenFundingCommand.ts` asserts `confirmed → funding`
  with the system actor, sets `targetFundingCents` from `proposedValue` (fallback `value`) when
  it is 0, keeps `fundedCents`, appends `statusHistory`. Returns `{ from, to, targetFunding }`
  (reais). 409 on wrong status, 404 unknown id, 403 non-admin.
- **Gap 3** (`a2b23fd`): `POST /v1/admin/receivables/:id/advance-stage`, same auth, no body.
  `adminAdvanceStageCommand.ts` maps `funded → processing`, `processing → completed`,
  `completed → payer_settled`, delegating to `executeSystemAdvanceSettlement` /
  `executeSystemPayerSettlement` so the pro-rata payout runs. Returns `{ from, to }`; any other
  status (including `confirmed`, `funding`, `overdue`, terminal) → 409
  `invalid_admin_stage_advance`. Internal API-key routes untouched.
- Routes live in `src/modules/receivable/api/receivable-admin.ts`, registered from
  `registerReceivableModule.ts` inside the JWT scope. Rule `module-receivables.mdc` routes
  table updated.
- Tests: `tests/modules/receivable/application/adminOpenFundingCommand.test.ts`,
  `adminAdvanceStageCommand.test.ts`, `tests/routes/v1/receivable-admin.test.ts`.
  `npm test`: 327 pass, 0 fail. `npm run lint` clean.
- Evidence (real server, SQLite in the scratchpad, `seed-dev` accounts, curl): seller submit →
  analyst offer 900 → seller accept → `advance-stage` on `confirmed` = 409 → seller
  `open-funding` = 403 → admin `open-funding` = 200 `{"from":"confirmed","to":"funding",
  "targetFunding":900}` → investor `GET /v1/receivables` lists it → investor invests 900 →
  `funded` → `advance-stage` ×3 = 200 `funded→processing`, `processing→completed`,
  `completed→payer_settled` → investment `settled`, investor balance back to 1,000,000 →
  fourth `advance-stage` = 409.
- Findings for later gaps:
  - `scripts/seed-dev.ts` does not run migrations; on an empty SQLite file it fails with
    `no such table: accounts`. Start the server once first (it migrates), then seed. Relevant
    for gap 4 (one-command reset + seed).
  - Receivables created through the normal flow have `yieldRateAnnual = 0`, so the payout
    returns principal only. `open-funding` does not set a yield. For the demo either the seed
    sets `yieldRateAnnual` (gap 5) or open-funding grows a `yieldRateAnnual` body field.
  - Fastify returns 400 `FST_ERR_CTP_EMPTY_JSON_BODY` if the client sends
    `content-type: application/json` with an empty body on the no-body admin routes (same as
    the existing `/submit`). Frontend: call them without a JSON content-type, or send `{}`.
- Smoke script committed as `scripts/smoke-admin-lifecycle.sh` (unique bill number per run).
  Gap 2 on the founder's Postgres = start the API on `DATABASE_URL=postgres://...`, run
  `npm run seed:dev`, then `BASE=http://localhost:8081 bash scripts/smoke-admin-lifecycle.sh`
  and compare with the SQLite output above.
- Push from this cloud session was refused by the git proxy (`vvmafra/dupply-backend is not in
  this session's authorized repository set`). Commits exported as a git bundle + patches and handed to the
  founder through the session (not committed to the repo).
- Next: frontend buttons for gaps 1 and 3 (`dupply-frontend`), then gap 0 seed + admin
  service wiring, then gap 2 on the founder's Postgres.

## Open questions for the founder

- Frontend commits: allowed (confirmed 2026-09-28).
- Which user / environment showed the "offers not showing" bug on 2026-09-27? Still unknown;
  reproduce locally first.
- Render / Vercel URLs and whether Supabase is the production DB: needed only for gap 6.
