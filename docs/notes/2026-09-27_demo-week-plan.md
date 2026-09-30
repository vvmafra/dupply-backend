# Demo week plan (target: everything working by Wednesday 2026-09-30 night)

Demo: Friday 2026-10-02, live, frontend on Vercel + backend on Render + Supabase Postgres.
Thursday 2026-10-01 is reserved for fixing what broke in the rehearsal.

## Decisions assumed (override before Monday if wrong)

| Topic | Default | Why |
|---|---|---|
| Step 6 (open funding) | Admin button in the frontend calling a new admin route | Requested by the founder |
| Steps 8–9 (pay seller, payer settles) | Admin buttons calling two new admin routes; curl script as fallback | Same pattern as step 6, small; avoids typing curl on stage |
| Step 1 (seller registration) | Demo starts with a seeded seller in `in_review`; analyst approves on screen | Wiring the registration wizard to 3 backend calls is frontend work with low demo value |
| Step 2 (AI score) | Seed writes an `aiReport` JSON on the demo receivable; analyst screen renders it | No agent exists; the frontend component already exists |
| Step 7 deposit | Seeded balance, no deposit screen | Deposit route exists but no UI; not worth the time |
| External integrations | None live | Legal viability not confirmed; Stellar testnet only if already wired |
| Database | Local Postgres 18 for parity tests; Supabase for the rehearsal | Never run destructive scripts against Supabase without an explicit go |

## Gap list (risk order)

0. **Offers not showing for investor or admin** (reported by the founder on 2026-09-27). Suspects: Supabase has no receivable in `funding` (seed never ran there); admin "ready for offer" list filters on mock state; Vercel env pointing to the wrong API. Reproduce first on the deploy with the founder's user.
1. Open funding: route + state machine + admin button.
2. Postgres parity: rerun the API smoke on local Postgres; fix transactions/timestamps.
3. Steps 8–9 as admin actions.
4. Reset + seed of the demo state in one command, safe for Supabase (explicit flag).
5. Seed with `aiReport`, seller in `in_review`, one receivable per demo stage.
6. Deploy config: Vercel `VITE_API_BASE_URL` → Render; Render `CORS_ALLOWED_ORIGINS` → Vercel domain.
7. `statusHistory` on system transitions (only if a screen shows the timeline).
8. Seller `createdAt` year 58704 (check on Postgres).
9. Balance race — documented, not in the demo path.

## Day by day

### Monday 2026-09-28
- Morning: reproduce gap 0 on the deploy; fix.
- Gap 1 backend (route, transition, tests) — commit.
- Gap 1 frontend (admin button wired) — commit in `dupply-frontend`.
- Gap 2: create local Postgres DB, run smoke, fix — commit.

### Tuesday 2026-09-29
- Gap 3: two admin routes + buttons — commit per route.
- Gap 5 then 4: demo seed and one-command reset — commit.
- Gap 6: deploy backend to Render, apply schema, run demo seed on Supabase, point Vercel to Render.
- First end-to-end run on the deploy (API only).

### Wednesday 2026-09-30
- Full rehearsal on the deploy, clicking through the frontend as seller, analyst, admin, investor.
- Write `docs/notes/2026-09-30_demo-runbook.md`: script, credentials, commands, what to do if each step fails.
- Second rehearsal after fixes. Stop adding features at 18:00.

### Thursday 2026-10-01
- Fixes only. Third rehearsal. Freeze.

### Friday 2026-10-02
- Reset demo state 1 hour before. Demo.

## Presentation consistency (slide "Status plataforma")

Checked against the code on 2026-09-27:

| Slide claim | Code reality | Verdict |
|---|---|---|
| Access and profiles implemented | JWT roles seller / risk_analyst / admin / investor, guards in place | true |
| Full duplicata cycle, "from registration to completion" | State machine exists; `confirmed → funding`, seller payment and settlement have no product route, only internal API-key routes and a dev script; no money moves | overstated |
| Offers and quotas: structure for creation and participation | Participation (invest) exists; offer creation does not exist in the backend and is an in-memory mock in the frontend; "quotas" of R$ 100 are a frontend-only concept | overstated |
| Operational panel | Admin pages read mock data (`admin.service.ts` imports only mocks) | overstated |
| Internal financial flow: deposit and distribution rules | Off-chain ledger with deposit / withdraw / invest / pro-rata payout, tested | true, with the concurrency caveat |
| Next steps: MFA, recovery, investor onboarding, KYC provider, documents, tokenization in the cycle, payments, payer communication | None of these exist (no documents table, payer notification is a no-op stub, registry not linked to receivables, no MFA/recovery, investors cannot self-register) | consistent |

Missing from "next steps" and worth adding: offer as an entity with CVM 88 parameters, real settlement (bank/PIX) with reconciliation, funding backstop or pre-funding partner, security hardening before real money, on-chain indexer.
