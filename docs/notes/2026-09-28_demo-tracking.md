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
| 0 | Offers not showing for investor / admin | backend + frontend | backend verified (seed + listing), frontend todo | backend `4b202e0` | session log 2026-09-28 (cloud, 2nd) |
| 1 | Open funding: admin route + admin button | backend + frontend | backend done, frontend todo | backend `6b0a4a3` | session log 2026-09-28 (cloud) |
| 3 | Pay seller / payer settles as admin actions + "advance stage" button | backend + frontend | backend done, frontend todo | backend `a2b23fd` | session log 2026-09-28 (cloud) |
| 2 | Postgres parity smoke (founder, local Postgres) | backend | todo | | |
| 5 | Demo seed: `aiReport`, seller `in_review`, one receivable per stage, investor balance | backend | done | `4b202e0` | session log 2026-09-28 (cloud, 2nd) |
| 4 | One-command reset + seed, Supabase only with explicit flag | backend | done | `2b430a3` | session log 2026-09-28 (cloud, 2nd) |
| 6 | Deploy config (founder) | both | not started | | |
| 7 | `statusHistory` on system transitions | backend | done (seed and live flow now match) | see session log 2026-09-29 | session log 2026-09-29 |
| 8 | Seller `createdAt` year 58704 on Postgres | backend | check during gap 2 | | |
| 9 | Balance race | backend | accepted debt | | |
| 10 | Monthly yield + minimum ticket on offers (approved by the founder 2026-09-28) | backend + frontend | backend done, frontend todo | backend `e34e88a` | session log 2026-09-28 (cloud, 2nd) |

Session scope agreed on 2026-09-28: gaps 0, 1 and 3, in that order. Extended the same day by the
founder to "follow the board": gaps 10, 5 and 4 done in the second cloud session.

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
  - `scripts/seed-dev.ts` now runs the SQLite migrations itself (this session's "fix(scripts): seed-dev" commit), so
    `npm run seed:dev` works on an empty `data/dupply.db` without starting the API first.
    No-op on Postgres. Relevant for gap 4 (one-command reset + seed).
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

### 2026-09-28 (cloud session, 2nd: gaps 10, 0 backend, 5, 4)

Branch `feat/demo-local`, one commit per gap, all pushed. `npm test`: 343 pass, 0 fail; lint clean.

- **Gap 10** (`e34e88a`, new, approved by the founder): `yield_rate_annual` replaced by
  `yield_rate_monthly` (simple monthly rate as a fraction, 0.018 = 1.8% a.m.) plus
  `min_investment_cents`; migration `drizzle/0001_yielding_skin.sql` (SQLite; Postgres via
  `db:push`). Analyst sets `yieldRateMonthly` / `minInvestment` with the offer on
  `POST /v1/receivables/:id/risk-decision` (only with `offer`, else 400
  `offer_terms_not_allowed_for_reprove`). Admin may override them with an optional body on
  `open-funding`; both routes return the terms. Validation in
  `receivable/domain/offerTerms.ts` (rate in `[0, 0.1]`, ticket ≤ target, else 400
  `invalid_offer_terms`). Payout in `settlement/domain/yield.ts`:
  `principal × (rate / 30) × days`, days from the investment that closed the target, min 1.
  `POST /v1/investors/invest` rejects amounts below the ticket with 400
  `investment_below_minimum` unless the amount closes the remaining target exactly.
  Evidence (real server, curl): offer 900 @ 1.8% a.m. / ticket 100 → open-funding echoes the
  terms → invest 50 = 400 `investment_below_minimum` → invest 900 → advance ×3 → investor
  balance 1,000,000.54 (54 cents = 1 day of 1.8% a.m. on 900), investment `settled`.
- **Gap 0 backend** (verified, no code beyond the seed): with the new seed, investor
  `GET /v1/receivables` returns exactly the `funding` receivable (target 237,500, funded 50,000,
  1.5% a.m., ticket 1,000); admin sees all 11 stages. The remaining cause is the frontend
  `admin.service.ts` still reading mocks (see frontend list below).
- **Gap 5** (`4b202e0`): `npm run seed:dev` rewritten as an idempotent demo seed
  (`scripts/seed-dev.ts` + `scripts/seed/demo-fixtures.ts`). Accounts kept across runs;
  seller profiles, receivables, payers and the investor ledger wiped and recreated. Active
  seller "Nova Era Distribuidora" with one receivable per stage (`created`, `under_review`,
  `offer`, `confirmed`, `funding`, `funded`, `processing`, `completed`, `payer_settled`,
  `overdue`, `reproved`), full `receivableMetaData`, `statusHistory`, offer terms and an
  `aiReport` JSON in the exact `DuplicataAiReport` shape the analyst screen renders. Second
  seller "Horizonte Têxtil" in `in_review` (`seller.review@dupply.dev.local`). Investor with
  R$ 1,000,000 available, 5 active investments (292,250) and 1 settled, reconciled by a single
  deposit row. Verified through the API as investor, admin and analyst.
- **Gap 4** (`2b430a3`): `npm run db:reset` is the one command (wipe → migrate/push → seed).
  Guards verified: remote Postgres/Supabase refused without `ALLOW_REMOTE_DB_RESET=1`,
  production refused without `FORCE_DB_RESET=1`. All npm scripts now use
  `--env-file-if-exists=.env`, so cloud sessions without `.env` run them from env vars.
- Frontend clone read-only at `feat/demo-local` (`5f07a93`) was used only to match the
  `aiReport` shape and list the contract changes below. Nothing pushed there.
- Known stale doc, out of demo scope: `.cursor/rules/data-models-relationships.mdc` still
  describes `platform_users` / `receivable_md`; the receivables schema of record is in
  `module-receivables.mdc` and `schema.ts`.

#### Backend → frontend contract changes (for the frontend session)

1. `yieldRateAnnual` is gone. Receivables (`GET /v1/receivables`, `GET /v1/receivables/:id`) and
   investments (`GET /v1/investors/investments` → `receivable.yieldRateMonthly`) expose
   `yieldRateMonthly` as a fraction; display `× 100` with the suffix "% a.m.". Frontend refs:
   `services/offer.service.ts` (lines ~76, 78, 122, 139), `domain/offer/offer.types.ts:45`,
   `pages/investor/InvestorHomePage.tsx:265` (currently prints "% a.a.").
2. New `minInvestment` (reais, 0 = none) on receivables. `offer.service.ts` sets
   `minAmount = targetAmount`; use `r.minInvestment > 0 ? r.minInvestment : quotaPrice`.
3. `POST /v1/receivables/:id/risk-decision` with `decision: "offer"` accepts
   `yieldRateMonthly` (0–0.1) and `minInvestment` (reais). Analyst offer form should send them.
4. `POST /v1/admin/receivables/:id/open-funding`: optional body
   `{ yieldRateMonthly?, minInvestment? }`; response
   `{ from, to, targetFunding, yieldRateMonthly, minInvestment }`. Send no `content-type`
   (or `{}`) when there is no body.
5. `POST /v1/admin/receivables/:id/advance-stage`: no body, response `{ from, to }`, 409 on
   any status outside `funded | processing | completed`.
6. `POST /v1/investors/invest`: new 400 `investment_below_minimum`.
7. Demo accounts (password `dev-password-change-me`): `seller@`, `seller.review@` (in_review),
   `investor@`, `analyst@`, `admin@dupply.dev.local`. Investor balance is R$ 1,000,000 with
   active positions; `seller.review@` is what the admin approves in the demo.
8. Gap 0 frontend half: `services/admin.service.ts` imports only mocks; wire it to
   `GET /v1/receivables` when `VITE_USE_MOCKS=false`.

- Next: frontend items above (gaps 0, 1, 3, 10), then gap 2 on the founder's Postgres
  (`npm run db:reset` + `scripts/smoke-admin-lifecycle.sh`), then gap 6.

### 2026-09-29 (cloud session, gap 7 + advance-stage on overdue)

- Gap 7: every system transition now appends `statusHistory` (`systemAdvanceSettlement`,
  `systemPayerSettlement`, and `funding → funded` inside `executeInvest`), so the timeline of a
  receivable driven live through the demo matches the seeded ones. Helper moved to
  `src/shared/statusHistory.ts` (pure) and re-exported from `receivableHelpers.ts`, keeping the
  investor module off the receivable module's application layer.
- `POST /v1/admin/receivables/:id/advance-stage` also accepts `overdue → payer_settled` (late
  payment, same payout). The seed has one `overdue` receivable, so the admin button works on it.
- Frontend contract addition: item 5 of the list above, `advance-stage` is now valid on
  `funded | processing | completed | overdue`.

## Open questions for the founder

- Frontend commits: allowed (confirmed 2026-09-28).
- Which user / environment showed the "offers not showing" bug on 2026-09-27? Still unknown;
  reproduce locally first.
- Render / Vercel URLs and whether Supabase is the production DB: needed only for gap 6.
