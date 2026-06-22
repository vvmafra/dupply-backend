# Product Requirements Document — Remove Payer Confirmation Gate

## Overview

The receivable lifecycle currently requires the payer (sacado) to explicitly accept or reject an anticipation offer via a magic link after the seller accepts the risk analyst's proposal. The receivable stays in `approved` until the payer acts; only then can the platform advance to settlement (`confirmed → processing → completed → payer_settled`).

Business has decided that payer confirmation must **not** block the flow. The payer should be **notified informatively** about the anticipation, but the operation must proceed as soon as the seller accepts the analyst's offer. This PRD adopts **Approach B**: remove the intermediate `approved` status and transition directly from `offer → confirmed` when the seller accepts.

This change amends the receivable module v2 design documented in `tasks/prd-receivable-module/prd.md` and the current rules in `.cursor/rules/module-receivables.mdc`. It is a **breaking API and domain change** for any client or integration that relies on `approved`, `payer_rejected`, or the payer magic-link response route.

## Goals

- Remove the payer confirmation gate so settlement can proceed immediately after seller acceptance.
- Simplify the receivable status machine by eliminating `approved` and `payer_rejected`.
- Notify the payer about the anticipation without requiring any action from them to unblock the flow.
- Keep seller agency (accept/reject analyst offer) and all post-`confirmed` settlement stages unchanged.

**Success metrics:**
- Seller accept on `POST /v1/receivables/:id/seller-decision` transitions `offer → confirmed` (not `offer → approved`).
- No receivable can remain blocked waiting for payer action before `confirmed → processing`.
- `assertReceivableTransition` enforces the new machine with full unit test coverage.
- All public API docs (`API.md`, Swagger) reflect the updated lifecycle.
- Existing receivables in `approved` are migrated to `confirmed` without manual intervention.

## User Stories

- As a **seller**, I want my accepted offer to proceed to liquidation immediately so that I am not delayed waiting for payer confirmation.
- As a **risk analyst**, I want operations to advance once the seller accepts so that approved deals are not stuck in an intermediate state.
- As a **payer**, I want to be informed that a duplicata will be discounted and that I must pay Dupply at due date, without needing to click a confirmation link to unblock the seller.
- As the **platform system**, I want to advance receivables from `confirmed` through settlement stages exactly as today, without a payer action prerequisite.
- As an **admin**, I want historical receivables that reached `payer_rejected` to remain readable and auditable after the status is retired.

**Main flow:**
1. Seller creates a draft (`POST /v1/receivables`) → status `created`.
2. Seller submits (`POST /v1/receivables/:id/submit`) → status `under_review`.
3. Risk analyst reviews and either makes an offer (`under_review → offer`) or reproves (`under_review → reproved`).
4. Seller accepts or rejects the offer (`POST /v1/receivables/:id/seller-decision`):
   - accept → `offer → confirmed`
   - reject → `offer → rejected`
5. On `confirmed`, the system sends an **informational notification** to the payer (email — implementation may be delegated to Module 4; see Open Questions).
6. System advances the confirmed receivable: `confirmed → processing → completed` via internal routes.
7. At due date, system marks `completed → payer_settled` (payer paid) or `completed → overdue` (payer did not pay).

## Core Features

1. **Direct seller-to-confirmed transition**
   - What it does: when the seller accepts the analyst's offer, the receivable moves directly to `confirmed` in a single atomic transition.
   - Why it matters: removes the blocking `approved` state and aligns the domain with the business rule that payer consent is informational, not a gate.

2. **Retire `approved` and `payer_rejected` statuses**
   - What it does: removes both statuses from `RECEIVABLE_STATUS`, transition rules, duplicate-guard lists, DB partial indexes, API docs, and cursor rules.
   - Why it matters: avoids ambiguity about which status represents "ready for settlement" and eliminates dead-end terminal states that only existed for payer rejection.

3. **Deprecate payer magic-link response flow**
   - What it does: removes or deprecates `POST /v1/payers/magic-link/respond` and the `payer_magic_link` transition actor for status changes.
   - Why it matters: payer action no longer drives lifecycle transitions; keeping the route would imply a confirmation step that no longer exists.

4. **Informational payer notification on `confirmed`**
   - What it does: when a receivable enters `confirmed`, the platform notifies the payer (email) that the duplicata was discounted and that payment to Dupply is expected at due date.
   - Why it matters: payer awareness without blocking operations. Notification failure must not roll back the status transition (best-effort side effect).

5. **Data migration for in-flight receivables**
   - What it does: migrates any existing row with `status = 'approved'` to `confirmed`. Preserves rows with `status = 'payer_rejected'` as historical terminal records (no automatic re-open).
   - Why it matters: non-production or staging environments may already have receivables in the old statuses; migration prevents orphaned states.

6. **Downstream hook alignment**
   - What it does: updates references that today trigger on `approved` (e.g. on-chain registry creation per Module 7, duplicate-guard blocking lists) to trigger on `confirmed` instead.
   - Why it matters: tokenization and uniqueness rules must remain correct after the status rename/removal.

## Functional Requirements

1. **FR-1:** `POST /v1/receivables/:id/seller-decision` with `decision: "accept"` must transition `offer → confirmed` (replacing `offer → approved`). Ownership and `status = 'offer'` preconditions are unchanged.
2. **FR-2:** `POST /v1/receivables/:id/seller-decision` with `decision: "reject"` must continue to transition `offer → rejected` with no behavior change.
3. **FR-3:** `approved` and `payer_rejected` must be removed from `RECEIVABLE_STATUS` and from all transition rules in `assertReceivableTransition`.
4. **FR-4:** The `payer_magic_link` actor kind must no longer authorize any receivable status transition. The magic-link respond command and route must be removed or return a documented deprecation response (see OQ-2).
5. **FR-5:** System-only transitions from `confirmed` onward (`confirmed → processing → completed → payer_settled | overdue`, and `overdue → payer_settled`) must remain unchanged.
6. **FR-6:** When a receivable enters `confirmed` as a result of seller acceptance, the application layer must trigger a best-effort informational notification to the payer. Failure to send notification must not fail the seller-decision command.
7. **FR-7:** A one-time data migration must map all receivables with `status = 'approved'` to `status = 'confirmed'`. Receivables with `status = 'payer_rejected'` must remain queryable; no automatic transition out of that status.
8. **FR-8:** Duplicate-guard active statuses must no longer include `approved`; `confirmed` remains a blocking status. Duplicate-guard terminal statuses must no longer include `payer_rejected` for **new** receivables (historical rows may still carry the old value).
9. **FR-9:** Partial unique indexes and any CHECK constraints in the DB schema that reference `approved` must be updated to use the new status set.
10. **FR-10:** `API.md`, Swagger summaries, and `.cursor/rules/module-receivables.mdc` must document the simplified lifecycle (10 statuses instead of 12).
11. **FR-11:** All mutating routes must continue to call `assertReceivableTransition`; no inline role checks in HTTP handlers.
12. **FR-12:** Unit and integration tests for seller decision, system advance, payer settlement, and duplicate guard must be updated to reflect the new machine. Tests for payer magic-link accept/reject must be removed or replaced.

## Technical Constraints

- Scope: backend only (`src/`). Frontend changes are out of scope but consumers must be notified of breaking status/API changes.
- A DB migration is required: update status CHECK constraints / partial indexes; run data migration `approved → confirmed`.
- Breaking change: public lifecycle and possibly removal of `POST /v1/payers/magic-link/respond`. Acceptable per product decision; document in release notes.
- Notification transport (email provider, templates, Module 4 ports) details belong in the Tech Spec; this PRD only requires the hook and best-effort semantics.
- `assertReceivableTransition` remains the single source of truth for status transitions.
- Registry / tokenization trigger point moves from `approved` to `confirmed` (coordination with Module 7 — see OQ-4).

## Out of Scope

- Payer ability to reject or dispute an anticipation via self-service (no `payer_rejected` replacement in v1 of this change).
- Legal copy finalization for payer notification emails.
- Frontend updates to status labels, filters, or seller/payer UI flows.
- Audit log for status transitions (separate feature).
- Cursor-based pagination on `GET /v1/receivables`.
- Re-enabling payer confirmation as an optional feature flag.

## Open Questions

- **OQ-1:** Notification ownership — should FR-6 be implemented entirely in this feature (application command + port stub), or delegated to Module 4 with only a hook/event emitted here? **Owner:** product + backend lead.
- **OQ-2:** Deprecation strategy for `POST /v1/payers/magic-link/respond` — hard delete (404) vs. soft deprecation (410 Gone + message) for a transition period? **Owner:** product + API consumers.
- **OQ-3:** Historical `payer_rejected` rows — keep the string value in DB for audit only (no new transitions), or migrate to a generic terminal status? **Owner:** product + data.
- **OQ-4:** Module 7 registry hook — confirm that on-chain tokenization should fire on `confirmed` (same business moment as today’s `approved`). **Owner:** registry module owner.
- **OQ-5:** Legal/compliance — confirm that informational notification without explicit payer consent is acceptable for the anticipation product in target jurisdictions. **Owner:** legal + product.
