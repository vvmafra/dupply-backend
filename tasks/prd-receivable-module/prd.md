# Product Requirements Document — Receivable Module v2

## Overview

The receivable (duplicata) is the core financial asset of the Dupply platform. It represents a trade bill that a seller wants to anticipate. The current implementation (`src/routes/v1/receivables.ts`, `src/application/receivable/`, `src/domain/receivable/`) was built as a prototype and has significant divergences from the intended business model: it uses legacy `platform_users` references instead of the `sellers`/`payers` FK model, is missing several lifecycle statuses, lacks the seller decision step after the analyst's offer, does not support draft creation, and stores timestamps in legacy `text` ms-epoch format.

This PRD defines the full rewrite of the receivable module to align with the v2 domain model. It replaces the current code end-to-end: schema migration, domain rules, application commands, and HTTP routes.

## Goals

- Replace the prototype receivable implementation with the production-grade v2 model.
- Implement the complete 12-status lifecycle, including the seller decision step and payer confirmation via magic link.
- Align the schema with the v2 entity model (`sellerId` FK → `sellers`, `payerId` FK → `payers`, native `timestamp` columns, `receivableMetaData` JSON with English keys).
- Enforce RBAC at the domain layer via a single `assertReceivableTransition` guard, eliminating scattered inline role checks.
- Expose all routes following the project's Fastify + Zod + Swagger standard (`routes-swagger.mdc`).

**Success metrics:**
- All 12 statuses exist in `RECEIVABLE_STATUS` and are covered by unit tests in `transitions.test.ts`.
- Every mutating route calls `assertReceivableTransition` — no inline role checks in handlers.
- All routes appear correctly in the Swagger UI at `/docs` with `tags`, `summary`, and `security` fields populated.
- `GET /v1/receivables` returns only the caller's own receivables when the JWT role is `seller`.
- A seller with `status !== 'active'` receives `403` on `POST /v1/receivables`.

## User Stories

- As a **seller**, I want to start filling a receivable form and save it as a draft so that I can continue later without losing my data.
- As a **seller**, I want to submit a completed receivable for risk analysis so that I can request anticipation.
- As a **seller**, I want to accept or reject the analyst's proposed value so that I stay in control of the terms.
- As a **risk analyst**, I want to review submitted receivables and either make an offer or reprove them so that I can manage the platform's risk exposure.
- As a **payer**, I want to accept or reject a discount offer via a magic link so that I can decide whether to pay directly to Dupply.
- As the **platform system**, I want to advance a confirmed receivable through settlement stages so that the full payment cycle is tracked end to end.

**Main flow:**
1. Seller creates a draft (`POST /v1/receivables`) → status `created`.
2. Seller fills the form and submits (`POST /v1/receivables/:id/submit`) → status `under_review`.
3. Risk analyst reviews and either makes an offer (`under_review → offer`) or reproves (`under_review → reproved`).
4. Seller receives the offer and either accepts (`offer → approved`) or rejects (`offer → rejected`).
5. On `approved`, the system dispatches a magic link email to the payer (handled by Module 4 — out of scope here).
6. Payer responds via magic link (`POST /v1/payers/magic-link/respond`): accepts (`approved → confirmed`) or rejects (`approved → payer_rejected`).
7. System advances the confirmed receivable: `confirmed → processing → completed` via internal route.
8. At due date, system marks `completed → payer_settled` (payer paid) or `completed → overdue` (payer did not pay).

## Core Features

1. **Draft lifecycle (`created` status)**
   - What it does: `POST /v1/receivables` creates a receivable with status `created` and minimal required fields. The seller can `PATCH` it freely until submission.
   - Why it matters: sellers need to fill a multi-field form over multiple sessions without losing data. The current implementation skips this step and creates receivables directly in `under_review`.

2. **Complete 12-status state machine**
   - What it does: replaces the current 6-status machine with the full lifecycle: `created`, `under_review`, `reproved`, `offer`, `rejected`, `approved`, `payer_rejected`, `confirmed`, `processing`, `completed`, `payer_settled`, `overdue`.
   - Why it matters: the current machine is missing the seller decision step and the full settlement tracking needed for collections.

3. **Seller decision route (`offer → approved / rejected`)**
   - What it does: `POST /v1/receivables/:id/seller-decision` with `{ decision: "accept" | "reject" }` allows the seller to respond to the analyst's offer.
   - Why it matters: in the current code the seller has no agency after the analyst acts — the payer is notified immediately without the seller's consent.

4. **Payer response route (`approved → confirmed / payer_rejected`)**
   - What it does: `POST /v1/payers/magic-link/respond` with `{ decision: "accept" | "reject", token }` consolidates the payer's accept/reject into one route.
   - Why it matters: the current route only supports acceptance (`confirm`); rejection was not handled.

5. **Settlement tracking (`completed → payer_settled / overdue`)**
   - What it does: `POST /v1/internal/receivables/:id/payer-settlement` advances a `completed` receivable to `payer_settled` or `overdue`, triggered by the system after the payer's due date.
   - Why it matters: gives the platform full traceability for collections — both who owes what and whether it was paid.

6. **v2 schema alignment**
   - What it does: migrates the DB table to use `seller_id` FK → `sellers`, `payer_id` FK → `payers`, native `timestamp` columns, and a structured `receivable_meta_data` JSON with English keys.
   - Why it matters: the current table references `platform_users` directly (legacy), uses `text` ms-epoch timestamps, and has no separation between payer identity and account identity.

## Functional Requirements

1. **FR-1:** `POST /v1/receivables` must be restricted to `seller` role and create a receivable with status `created`. The seller's `profileId` (from JWT) is resolved to `sellerId`. The payer is identified by `payerCnpj` via upsert on the `payers` table.
2. **FR-2:** `PATCH /v1/receivables/:id` must only be allowed when `status = 'created'`. Attempts on any other status must return `409`.
3. **FR-3:** `POST /v1/receivables/:id/submit` must validate that `receivableMetaData` contains all required fields before transitioning to `under_review`. Incomplete metadata must return `400`.
4. **FR-4:** `POST /v1/receivables/:id/risk-decision` must be restricted to `risk_analyst` and `risk_analyst_agent`. When `decision = "offer"`, `proposedValue` is required. When `decision = "reprove"`, `proposedValue` must be null/absent.
5. **FR-5:** `POST /v1/receivables/:id/seller-decision` must enforce ownership (seller's `profileId` must match `receivable.sellerId`). Only allowed when `status = 'offer'`.
6. **FR-6:** `POST /v1/payers/magic-link/respond` must validate the magic link token (delegated to Module 4 token validation). The token encodes `receivableId` + `payerId`. Route transitions `approved → confirmed` or `approved → payer_rejected` depending on `decision`.
7. **FR-7:** `GET /v1/receivables` must scope results by role: `seller` sees only their own, `risk_analyst` and `admin` see all (paginated, default limit 200).
8. **FR-8:** `GET /v1/receivables/:id` must enforce that a `seller` can only read their own receivable; `payer` may not access receivables via this route (payer context is through the magic link flow).
9. **FR-9:** Internal routes (`/v1/internal/receivables/*`) must require `X-Dupply-Api-Key` authentication. They must be hidden from the public Swagger spec (`schema: { hide: true }` or tagged `Internal`).
10. **FR-10:** All mutating routes must call `assertReceivableTransition(from, to, actor)` from `src/domain/receivable/transitions.ts`. No inline role checks are permitted in HTTP handlers.
11. **FR-11:** The DB schema must use `seller_id` (FK → `sellers.id`), `payer_id` (FK → `payers.id`), native `timestamp` for `created_at`/`updated_at`/`deleted_at`, and `text` decimal for `value`/`proposed_value`.
12. **FR-12:** `receivableMetaData` must be stored as a JSON string. The canonical TypeScript shape is defined in `module-receivables.mdc`. Validation of metadata completeness occurs in the application layer on submit (FR-3), not on draft creation.
13. **FR-13:** A seller with `seller.status !== 'active'` must receive `403 seller_not_active` on `POST /v1/receivables`.
14. **FR-14:** `sellerId` and `payerId` must always differ on the same receivable. Attempt to create a receivable where the seller's own CNPJ matches the payer CNPJ must return `400 seller_and_payer_must_differ`.

## Technical Constraints

- Scope: backend only (`src/`). No frontend changes in this PRD.
- A DB migration is required: drop/rename legacy columns (`seller_user_id`, `payer_user_id`, `created_at_ms`, `updated_at_ms`) and add new columns (`seller_id`, `payer_id`, `created_at`, `updated_at`, `deleted_at`).
- The `payers` table (Module 4) must exist before this migration runs. This module depends on Module 4 being implemented first, or both being migrated together.
- Must not break the existing Swagger spec shape for routes that are being replaced — use `summary` updates only; breaking changes are acceptable since this is a full rewrite of a non-production module.
- All new commands go under `src/application/receivable/commands/`. Queries go under `src/application/receivable/queries/` (CQRS split per `ARCHITECTURE-RULES.md`).
- `src/domain/receivable/transitions.ts` is the single source of truth for status transitions and must not be duplicated in any other layer.

## Out of Scope

- Magic link token generation and email dispatch — handled by Module 4 (payer). This PRD only defines the route that consumes the token.
- `registry_on_chain` creation on `approved` — handled by Module 7. This PRD only defines the receivable lifecycle; the hook to trigger tokenization is Module 7's concern.
- Payer notification emails (e.g. notifying seller when payer rejects) — Module 4.
- Admin-facing receivable management UI or additional admin routes beyond `GET /v1/receivables`.
- Audit log for status transitions — separate feature.
- Pagination beyond the default limit-200 on `GET /v1/receivables`.

## Open Questions

- **OQ-1:** ~~Should `overdue` be recoverable?~~ **Resolved:** `overdue` is recoverable — it can transition to `payer_settled` if the payer pays late. `overdue` is not terminal; `payer_settled` is the only terminal end state for the payment cycle.
- **OQ-2:** ~~When a `payer_rejected` occurs, can the seller resubmit?~~ **Resolved:** `payer_rejected` is terminal for that receivable. The seller may open a **new** receivable for the same bill if desired.
- **OQ-3:** ~~Payer upsert strategy on CNPJ collision.~~ **Resolved:** preserve existing values (Option A). If the CNPJ already exists in `payers`, reuse the record as-is without overwriting `legalName` or `email`.
