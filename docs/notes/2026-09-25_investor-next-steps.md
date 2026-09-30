# Investor presentation — next steps after the prototype

**Date:** 2026-09-25
**Audience:** investor meeting (Friday 2026-10-02) — supporting material for the "next steps" slides of *Proposta Estratégica - Dupply v1*.
**Status:** draft for the founders. Nothing in the legal section has been validated by counsel.

How to read this document:

- **[FACT]** — something verified in the code on 2026-09-25, with file and line. Line numbers refer to branch `feat/investor-ramp` at commit `c5488b7`.
- **[OPINION]** — a recommendation or an interpretation. Open for debate.
- **[TO CONFIRM]** — a legal or regulatory statement that must be checked with a lawyer before it is repeated to anyone.

---

## 1. Phases

No dates on purpose — the founders fill them in.

### Today — functional prototype

What exists and runs end to end (verified with a scripted smoke run on 2026-09-25, see `docs/notes/2026-09-25_demo-runbook.md` once written):

- [FACT] Seller registration, metadata, submission for review and approval by a risk analyst: `src/modules/seller/api/sellers.ts`, `src/modules/auth/api/auth.ts:72-110`.
- [FACT] Receivable lifecycle `created → under_review → offer → confirmed` with role-checked transitions in `src/modules/receivable/domain/transitions.ts:60-140`.
- [FACT] Investor off-chain ledger (`investors.balanceCents`, `src/infra/database/schema.ts:243-258`), deposit / withdraw / invest commands with idempotency keys, auto-transition `funding → funded` when the target is hit (`src/modules/investor/application/commands/executeInvestCommand.ts:104-135`).
- [FACT] Pro-rata payout to investors on `completed → payer_settled`, interest = principal × (annual rate / 365) × days, minimum 1 day (`src/modules/settlement/application/commands/executePayoutCommand.ts:35-49`).
- [FACT] Soroban registry contract deployed on Stellar testnet; the API returns an **unsigned** XDR and the client signs (`src/infra/gateways/ports/registryGateway.ts:1-30`). The backend never holds a signing key.
- [FACT] Frontend (`../dupply-frontend`, branch `feat/investor`) talks HTTP to the API for login, seller review, receivable submission/decisions and investor invest/portfolio. Seller self-registration, admin offer creation, deposits and settlement are still mocks or manual (`src/services/*.ts` without `resolveApiMode`).

What is explicitly **not** there:

- [FACT] No route opens funding (`confirmed → funding`) or sets `targetFundingCents` / `yieldRateAnnual`; only the dev script does it by direct SQL (`scripts/advance-receivables.ts:78-82`) and the seed (`scripts/seed-dev.ts`).
- [FACT] No AI score endpoint. `receivables.aiReport` / `aiReportPdfUrl` columns exist (`src/infra/database/schema.ts:166-167`) but nothing in `src/` writes them.
- [FACT] Settlement module is a placeholder (`src/modules/settlement/README.md`); PIX provider is a stub; no bank or payment integration.
- [FACT] No KYC/AML module; only an Etherfuse KYC smoke script (`scripts/etherfuse-kyc-smoke.ts`).
- [FACT] No indexer for on-chain events (`indexer/README.md`).

### Phase 1 — hardening (before any real money)

- Financial transaction safety: see section 4 (race conditions, idempotency, audit trail, integer money).
- Offer as a first-class entity with CVM 88 parameters (target, minimum, deadline, partial distribution rule, withdrawal window, per-investor caps). [OPINION] Today the "offer" is three columns on `receivables` (`schema.ts:173-175`); that is fine for a demo and wrong for a regulated product.
- Payment integration (PIX in/out) behind the existing `SettlementGateway` port (`src/infra/gateways/ports/settlementGateway.ts`), with signed webhooks and reconciliation.
- KYC/KYB provider for sellers and investors; LGPD data map.
- Legal structure decided (section 3): what the investor buys, who issues, who is the offeror.

### Phase 2 — controlled pilot

- A handful of sellers and investors under NDA-style terms, low ticket sizes, one payer relationship at a time.
- Paid infrastructure with backups and monitoring (Postgres with point-in-time recovery, alerting, error tracking).
- Manual operations allowed (an operator opens funding, confirms payer payment) but every action leaves an audit row.
- Success criteria: N full cycles closed (seller paid, payer settled, investors paid) with zero reconciliation differences.

### Phase 3 — scale

- Automated funding close, backstop or pre-funding partner live (section 2).
- Registrar integration for duplicata escritural, e-signature for assignment.
- Multi-payer, multi-seller onboarding, secondary features (early exit, secondary market) only after legal sign-off.

---

## 2. The anticipation-time bottleneck

**The problem.** A seller who anticipates a duplicata wants cash in hours or days. A public crowdfunding raise takes days to weeks and, under CVM 88, has a mandatory investor withdrawal window after subscription [TO CONFIRM — see 3.1]. So the platform cannot promise "money now" if the money only exists after the raise closes. The prototype makes this visible: `confirmed → funding → funded → processing → completed` is sequential and the seller is paid only at `completed` (`transitions.ts:77-95`).

[FACT] The current invest command flips to `funded` only when `fundedCents === targetFundingCents` exactly (`executeInvestCommand.ts:104`); there is no minimum target, no deadline and no partial-close rule in the schema.

Two ways to close the gap. They are not mutually exclusive.

### Alternative A — backstop (fund or factoring completes the raise)

- A partner (FIDC, factoring, or the platform's own vehicle) commits **in advance and publicly** to take any unsold portion at the deadline, provided the offer reached a minimum.
- Investors see the commitment on the offer page; the seller is guaranteed the cash on the deadline date, not before.
- Pros: simple to explain, the offer remains a genuine public raise, the backstop only absorbs residual risk.
- Cons: still bounded by the raise duration plus the withdrawal window; the backstop partner needs a pricing and a cap; the commitment itself may need legal drafting (a firm underwriting-like obligation) [TO CONFIRM].
- [FACT] The frontend already models this idea in mock data (`fidcBackfillAmount`, `backfillSource: "fidc"` in `../dupply-frontend/src/services/offer.service.ts:83-84`), so the product story is consistent.

### Alternative B — pre-funding (factoring buys, platform tokenizes and re-syndicates)

- The factoring buys the duplicata and pays the seller immediately (day 0).
- The platform tokenizes the receivable and opens the offer with the **factoring as offeror**. Investors buy fractions from the factoring, replenishing its cash.
- The factoring keeps a **subordinated tranche** (first loss). Investors hold the senior tranche.
- Pros: the seller's time-to-cash is the factoring's, not the raise's; first-loss alignment is a strong story for investors; it is the structure the RWA market converged on.
- Cons: the factoring becomes originator, analyst and anchor investor at once (conflict of interest, section 3.7); the factoring needs its own balance sheet; whether a factoring may be the offeror in a CVM 88 raise is an open legal question (3.3).

### References from the RWA / tokenized-credit market

[OPINION] Useful as pattern references, not as legal precedents for Brazil.

- **Centrifuge** — pools with senior (DROP) and junior (TIN) tranches; the originator typically holds the junior tranche as first loss.
- **Goldfinch** — senior pool plus "backers" who supply junior capital per borrower pool; senior capital is deployed automatically once backers commit.
- **Maple** — pool delegates underwrite; first-loss capital ("pool cover") is posted by the delegate.
- **Liqi (Brazil)** — tokenization of receivables and other assets for qualified and retail investors, working with regulated issuers.
- **Mercado Bitcoin (Brazil)** — fixed-income tokens backed by receivables, distributed under CVM oversight (including the regulatory sandbox).

All five confirm the same design choice: the originator or a specialised partner holds first loss and the public holds the senior piece. That is Alternative B.

---

## 3. Legal items to validate with counsel

Everything below is **[TO CONFIRM]**. Numbers quoted from memory of CVM Resolução 88 must be checked against the current text (amended since 2022) at <https://conteudo.cvm.gov.br/legislacao/resolucoes/resol088.html>.

### 3.0 Regulatory moment (as of 2026-09-27) — [TO CONFIRM with counsel]

- CVM Resolução 88 (2022, consolidated text) currently allows issuers with gross annual revenue up to R$ 40 million to raise up to R$ 15 million per calendar year through registered platforms; audit is required above R$ 10 million raised or R$ 30 million revenue. Per-investor annual limits apply per platform.
- CVM opened a public consultation on 2025-09-24 to **replace** Resolução 88; the comment period was extended to 2026-01-23 and the new rule is on CVM's 2026 regulatory agenda. The proposal raises caps (R$ 25 million for companies, R$ 50 million for securitisation companies) and drops the issuer revenue ceiling. Direction of travel: securitisation of receivables distributed through platforms, often tokenised, becomes the central model — exactly Dupply's space.
- Ofício Circular CVM/SSE 4/2023 and 6/2023 state that publicly offered receivable / fixed-income tokens are securities and that such offers may fit under Resolução 88 when made through a registered platform. Tokenising a duplicata and offering fractions to the public is therefore a securities offering unless structured otherwise.
- Practical consequence for Dupply: the platform either registers with CVM as a crowdfunding platform, operates through a partner that already is one, or restricts itself to a non-public structure (e.g. selling whole receivables to a factoring / FIDC). Which path is chosen changes the product (offer entity, investor caps, withdrawal window, segregated funds).

Sources checked on 2026-09-27: CVM consolidated text of Res. 88 (conteudo.cvm.gov.br), CVM news on OC SSE 4/2023 and 6/2023 (gov.br/cvm), CVM 2026 regulatory agenda (gov.br/cvm), law-firm summaries (Cescon Barrieu, Lefosse, Mattos Filho, Machado Meyer).

### 3.1 CVM Resolução 88 — crowdfunding platform rules

| Topic | What to confirm | Why it matters for the product |
|---|---|---|
| Platform registration | Registration of the platform with CVM, minimum capital, fit-and-proper of managers | Cannot run public offers before registration |
| Issuer revenue cap | Maximum annual gross revenue of the issuer (small company definition) | Filters which sellers (or which SPV/issuer) can use the platform |
| Annual raise cap | Maximum amount an issuer may raise per 12 months | Caps volume per seller/issuer |
| Maximum offer duration | Longest period an offer may stay open | Directly bounds time-to-cash (section 2) |
| Minimum / maximum target and partial distribution | Whether a minimum below the target is allowed and what happens on partial success | Defines the "funded" rule that today is `fundedCents === targetFundingCents` |
| Investor withdrawal right | Cooling-off period after subscription during which the investor may withdraw | Creates a **time floor** on every raise; money cannot be released to the seller before it ends |
| Per-investor annual cap (non-qualified) | Limit per calendar year for retail investors, exceptions by income/net worth | Requires investor classification and a running yearly total per investor |
| Segregation of funds | Investor money held segregated until the offer closes | Today `investors.balanceCents` is a row in the platform DB; real money must sit in a segregated account or escrow |
| Lead investor ("investidor líder") | Rules for a syndicate led by a professional investor | Possible vehicle for Alternative A/B anchors |

### 3.2 Does a duplicata fit under CVM 88?

- What does the investor legally buy: a commercial note (nota comercial), a CCB, a quota of an FIDC, a token representing an assignment share, or something else?
- Who is the **issuer** for CVM 88 purposes: the seller (cedente), an SPV, the factoring, or a securitisation vehicle?
- Is a fractional assignment of a single duplicata to many retail investors even a securities offering, or a plain civil-law credit assignment? Both answers have consequences.

### 3.3 Can a factoring be the offeror?

- Fomento mercantil companies buy receivables with their own capital; raising money from the public may be restricted or require a different vehicle (FIDC, securitisation company).
- Confirm whether Alternative B needs the factoring to transfer the receivables to a regulated issuer before the public raise.

### 3.4 Receivable tokens as securities

- CVM Parecer de Orientação 40 (crypto-assets as securities, 2022).
- Ofício Circular CVM/SSE on tokenization of receivables (2023) — confirm the exact number and its current status.
- Question to answer: is the token itself a security, or is it only a representation of an off-chain assignment?

### 3.5 Duplicata escritural and the registrar

- Lei 13.775/2018 and the Central Bank rules for duplicata escritural.
- Which BACEN-authorised registrar the platform will use, and what "registration" on the Soroban contract means legally (today it is a testnet record with no legal effect).

### 3.6 Credit assignment mechanics

- Formalisation of the assignment (instrument, e-signature), notification of the payer (sacado), and whether the seller is co-obligated (coobrigação / regresso).
- [FACT] The prototype only sends an informational email to the payer on `confirmed` and does not require acceptance (`src/modules/receivable/application/commands/sellerDecisionCommand.ts:41-50`).

### 3.7 Subordinated tranche and conflicts of interest

- Disclosure requirements for a first-loss tranche held by the originator.
- The factoring originates, analyses and anchors the same asset — conflict-of-interest policy and disclosure text.

### 3.8 AML / CFT (Lei 9.613/1998)

- KYC/KYB of sellers and investors, PEP screening, suspicious-transaction reporting, record keeping.
- Which entity is the obligated party (the platform, the payment provider, both).

### 3.9 LGPD

- KYC data and scores are personal data; some may be sensitive.
- The AI risk agent's decision is an **automated decision** — art. 20 gives the data subject the right to review; the product needs a human-review path and explanation text.
- [FACT] Seller CPF/CNPJ and representative data are stored as plain JSON text (`sellers.companyMetaData`, `legalRepresentativeMetaData`, `src/infra/database/schema.ts`), no field-level encryption.

### 3.10 Taxation

- Investor income tax on yield (which regime, who withholds), IOF on the operations, tax treatment of the factoring discount, invoicing of the platform fee.

---

## 4. Security items before real money

Each item: the fact in the code today, then the recommendation.

### 4.1 Race condition on balances and funding

- [FACT] `executeInvestCommand.ts:37-48` reads the investor row **outside** the transaction, `:125` writes `balanceCents: investor.balanceCents - amountCents` as an **absolute** value. Same pattern in `executeDepositCommand.ts:37, :95` and `executeWithdrawCommand.ts:37, :100`.
- [FACT] `executeInvestCommand.ts:103-104` computes `newFundedCents` outside the transaction and writes it absolutely at `:132-137`. Two concurrent investors can over-fund a receivable or both flip it to `funded`.
- [OPINION] Fix: relative updates inside the transaction (`SET balance_cents = balance_cents - ?` with a `WHERE balance_cents >= ?` guard, and `SET funded_cents = funded_cents + ? WHERE funded_cents + ? <= target_funding_cents`), or `SELECT … FOR UPDATE` on Postgres. Does not affect a one-user demo.

### 4.2 Idempotency

- [FACT] Unique index on (`investorId`, `idempotencyKey`) for deposits, withdrawals and investments (`schema.ts:278, :299, :322`). Good.
- [FACT] The frontend generates the key with `Date.now()` at click time (`../dupply-frontend/src/services/offer.service.ts:326`), so a retry after a network error creates a **new** key and a second investment.
- [FACT] No idempotency on the internal settlement routes (`src/modules/receivable/api/receivable-internal.ts`); a repeated `payer-settlement` call is protected only by the state machine.
- [OPINION] Key must be generated once per user intent (before the first attempt) and reused on retries; webhooks need an event-id dedupe table.

### 4.3 Webhook signature verification

- [FACT] The Etherfuse webhook verifies an HMAC and refuses to run without the secret (`src/modules/ramp/application/commands/applyRampWebhook.ts:51-60`). That is the only webhook today.
- [OPINION] Every future webhook (PIX provider, KYC provider, AI agent callback writing `aiReport`) must follow the same pattern: signature, timestamp tolerance, replay protection.

### 4.4 Key custody

- [FACT] Registry writes are client-signed; the API only simulates and returns an unsigned XDR (`registryGateway.ts:16-21`). No Stellar secret is read from env (`src/infra/env/config.ts`).
- [FACT] `wallets.secretEncrypted` column exists (`schema.ts:117`) and is always written as `null` (`registerSellerWalletCommand.ts:70`).
- [OPINION] Keep it that way. If the platform ever needs to sign (custodial wallets, automated payouts), use a KMS/HSM-backed signer, never an env var.

### 4.5 Audit trail

- [FACT] `receivables.statusHistory` is a JSON text column keyed by status (`schema.ts:172`), appended only by user-driven commands. System transitions (`funding`, `funded`, `processing`, `completed`, `payer_settled`) do not append (`systemAdvanceSettlementCommand.ts:25-28`, `systemPayerSettlementCommand.ts:83-88`, `executeInvestCommand.ts:130-137`). Verified in the smoke run: history stops at `confirmed`.
- [FACT] A status that repeats (e.g. `overdue → payer_settled` after a retry) cannot be recorded twice because the map is keyed by status name (`receivableHelpers.ts:22-37`).
- [OPINION] Replace with an append-only `receivable_events` table (who, when, from, to, reason, request id) and a `ledger_entries` table for every balance movement.

### 4.6 Money as integer cents

- [FACT] `receivables.value` and `proposedValue` are `text` (`schema.ts:170-171`); `fundedCents`, `targetFundingCents`, `balanceCents` are integers; `yieldRateAnnual` is a `real` (`:175`); interest is computed in floating point and rounded (`executePayoutCommand.ts:50-51`).
- [OPINION] Migrate `value`/`proposedValue` to integer cents, store the rate in basis points, and compute interest with integer arithmetic and a documented rounding rule (rounding differences today go nowhere — nobody keeps the remainder).

### 4.7 Backups, monitoring, rate limiting

- [FACT] Dev runs on a SQLite file; production target is Supabase Postgres via Render (`docs/notes/2026-05-22_render-deploy.md`). No backup or PITR configuration exists in the repo.
- [FACT] No rate limiting or security headers plugin is registered (`src/plugins/`, `package.json`).
- [OPINION] Before the pilot: PITR on Postgres, error tracking, request logging with correlation ids, rate limiting on `/v1/auth/*` and investor routes.

### 4.8 Segregation of investor funds

- [FACT] Investor money is a number in `investors.balanceCents`; deposits are accepted with an optional `externalTxId` and no proof of payment (`executeDepositCommand.ts`).
- [OPINION] Real deposits must be confirmed by the payment provider webhook, and the ledger must reconcile daily against the segregated account (see 3.1).

### 4.9 Other observed issues (cosmetic for the demo, real for production)

- [FACT] Seller rows created via `/v1/auth/register` return `createdAt` in year 58704 (observed in the smoke run; the command does not set timestamps and relies on the SQLite default, `registerSellerCommand.ts:27-45`).
- [FACT] `/v1/auth/register` accepts only `role: "seller"` (`auth.ts:33-38`); investors can only be seeded.
- [FACT] `GET /v1/receivables` for investors returns only `funding` rows (`listReceivablesQuery.ts:38-46`); after the raise closes the investor sees their position only through `/v1/investors/investments`.

---

## 5. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation | Phase |
|---|---|---|---|---|---|
| 1 | Regulatory: the product is a public securities offering without CVM registration | High if launched as is | Critical (enforcement, shutdown) | Legal opinion on 3.1–3.4 before any real raise; start under a regulated partner (FIDC / registered platform) if needed | 1 |
| 2 | Time-to-cash gap: sellers leave because funding takes too long | High | High (no product-market fit) | Alternative A or B (section 2); communicate deadline-based settlement clearly | 1–2 |
| 3 | Payer default (sacado does not pay) | Medium | High for investors | Payer credit analysis, concentration limits, first-loss tranche, collections process, co-obligation terms | 1–2 |
| 4 | Fraud: fake or duplicated duplicata | Medium | High | NF-e/SEFAZ validation, registrar check for duplicata escritural, duplicate guard already in code (`businessKey.ts`) | 1 |
| 5 | Ledger corruption from concurrency or partial failures | Medium at scale | Critical (money lost or created) | Section 4.1, 4.2, 4.5; daily reconciliation | 1 |
| 6 | Investor funds commingled with platform funds | Certain today | Critical (legal + trust) | Escrow / segregated account via payment provider; ledger reconciled to bank | 1 |
| 7 | Key or credential leak (JWT secret, API key, provider keys) | Medium | High | Secret manager, rotation, no secrets in `.env` on servers, least-privilege API keys | 1 |
| 8 | Data protection breach (KYC, CPF, scores) | Medium | High (LGPD fines, reputation) | Field encryption, access logging, retention policy, DPIA for the AI agent | 1–2 |
| 9 | AI agent gives a wrong or biased score | Medium | Medium | Human analyst keeps the final decision (already the case: `risk-decision` is manual), explanation stored with the score, art. 20 review path | 1 |
| 10 | Conflict of interest of the factoring/anchor in Alternative B | High if B chosen | Medium | Disclosure, independent pricing rule, cap on the factoring's share, audit | 2 |
| 11 | Infrastructure loss (no backups, single region) | Medium | High | PITR, tested restore, monitoring, on-call | 2 |
| 12 | Blockchain record has no legal effect and may confuse investors | High | Medium | Present the on-chain record as an audit trail, not as the title; use a BACEN registrar for legal effect | 2–3 |
| 13 | Key-person dependency (small team, single backend maintainer) | High | Medium | Runbooks, tests (312 passing today), documentation, second engineer in Phase 2 | 2 |

---

## Appendix — evidence from 2026-09-25

- `npm test`: 312 tests, 312 passed, 0 failed.
- `npm run db:reset`: recreated `data/dupply.db`, seeded seller / investor / analyst / admin accounts and two `funding` receivables.
- Scripted API smoke (register seller → approve → submit receivable → offer → accept → *manual SQL to open funding* → deposit → invest twice → funded → processing → completed → payer settled): every step returned 2xx except opening funding, which has no route (`400 validation_error` on `advance-settlement` with `targetStatus: "funding"`). Investor balance moved from R$ 995,200.00 to R$ 1,005,004.83 after payout (principal 9,800 + 1 day of 18% p.a.).
