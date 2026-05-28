# Product Requirements Document — Receivable Duplicate Guard

## Overview

Today a seller can create, update, or submit a receivable (duplicata) even when another non-terminal receivable for the same seller already represents the same underlying trade bill. Identifying fields — `billNumber` and `fiscalDocumentKey` — live inside `receivableMetaData` JSON and are not enforced at the database level, so duplicate submissions succeed silently.

This feature introduces a business-key uniqueness rule scoped per seller: only one **active** receivable may exist for a given bill identity at a time. Sellers who received a terminal outcome (`reproved`, `rejected`, `payer_rejected`) must be allowed to resubmit the same bill. The pattern mirrors the existing wallet module: an application-layer guard before write operations, backed by a partial unique database index as a concurrency safety net.

## Goals

- Prevent duplicate receivables for the same seller and bill identity while an active receivable is in flight.
- Return a clear, actionable HTTP `409` error when a duplicate is detected, so the frontend can surface it to the seller.
- Allow resubmission after terminal rejection outcomes without manual intervention.
- Normalize identifying fields consistently so formatting differences do not bypass the guard.

**Success metrics:**
- 100% of create, create-and-submit, submit, and draft-update operations that would collide with an active receivable return `409` instead of persisting.
- Sellers with a terminal receivable (`reproved`, `rejected`, `payer_rejected`) can successfully create a new receivable with the same business key.
- Concurrent duplicate requests for the same seller and business key result in at most one successful write (no silent duplicates under race conditions).

## User Stories

- As a **seller**, I want to be blocked from submitting the same duplicata twice while one is still being processed, so that I do not accidentally create conflicting operations.
- As a **seller**, I want to resubmit a duplicata after it was reproved or rejected, so that I can try again with corrected information.
- As a **risk analyst**, I want each active receivable to represent a unique bill per seller, so that my review queue is not polluted with duplicates.
- As the **platform**, I want duplicate detection enforced at both the application and database layers, so that integrity holds even under concurrent requests.

**Main flow:**
1. Seller creates or updates a draft with `billNumber` and/or `fiscalDocumentKey` in metadata.
2. Before any write (create, create-and-submit, submit, draft update), the system checks whether another non-deleted, non-terminal receivable for the same seller already holds the same normalized business key.
3. If a collision exists → HTTP `409` with a duplicate error code; no row is inserted or updated.
4. If no collision → operation proceeds as today.
5. After a receivable reaches a terminal rejection status, the seller may create a new receivable with the same business key.

## Core Features

1. **Business key definition**
   - What it does: Establishes which metadata fields uniquely identify a bill within a seller's portfolio (candidate keys: `(sellerId, billNumber)` and/or `(sellerId, fiscalDocumentKey)`).
   - Why it matters: Without an explicit key, duplicate detection is ambiguous and cannot be indexed reliably.

2. **Active duplicate guard on all write paths**
   - What it does: Blocks create (`POST /v1/receivables`), create-and-submit, submit (`POST /v1/receivables/:id/submit`), and draft update (`PATCH /v1/receivables/:id`) when the resulting metadata would collide with an existing active receivable for the same seller.
   - Why it matters: Duplicates can currently enter at any of these entry points; all must be covered.

3. **HTTP 409 duplicate errors**
   - What it does: Returns structured error responses (e.g. `receivable_already_exists`, or granular codes such as `duplicate_bill_number` / `duplicate_fiscal_key`) when a collision is detected.
   - Why it matters: The frontend needs a machine-readable signal to show the seller why the operation failed.

4. **Field normalization**
   - What it does: Applies consistent normalization to identifying fields before comparison and persistence (e.g. trim/uppercase for `billNumber`, digits-only for `fiscalDocumentKey`; `payerCnpj` normalization already exists).
   - Why it matters: Prevents bypass via whitespace, casing, or formatting differences.

5. **Status-scoped uniqueness**
   - What it does: Defines which receivable statuses count as "active" (blocking duplicates) versus "terminal" (allowing resubmission).
   - Why it matters: A seller legitimately resubmits after rejection; an in-flight receivable must still block duplicates.

6. **Database backstop index**
   - What it does: Adds a partial unique index on materialized identifying columns so concurrent writes cannot both succeed even if the application check races.
   - Why it matters: Application-only checks are fragile under concurrency; the wallet module already uses this dual-layer pattern.

## Functional Requirements

1. **FR-1:** Define the receivable business key as a combination of `sellerId` plus one or both identifying metadata fields (`billNumber`, `fiscalDocumentKey`). The final key choice must be documented in the Tech Spec.
2. **FR-2:** Before insert or update, the system must check whether another receivable for the same seller, with the same normalized business key, exists in an **active** (non-terminal) status and is not soft-deleted (`deletedAt IS NULL`).
3. **FR-3:** The duplicate guard must run on all seller-initiated write paths: create draft, create-and-submit, submit draft, and update draft metadata (when `billNumber` or `fiscalDocumentKey` changes or is set).
4. **FR-4:** When a duplicate is detected, the API must respond with HTTP `409` and an error code. Minimum: `receivable_already_exists`. Optionally granular codes (`duplicate_bill_number`, `duplicate_fiscal_key`) if both keys are enforced independently.
5. **FR-5:** Identifying fields must be normalized before comparison and before persistence: `billNumber` (trim; case normalization TBD — see Open Questions), `fiscalDocumentKey` (digits-only normalization TBD — see Open Questions), `payerCnpj` (14 digits, no formatting — already enforced).
6. **FR-6:** The following statuses are **terminal for duplicate purposes** — a receivable in one of these statuses does **not** block a new receivable with the same business key: `reproved`, `rejected`, `payer_rejected`, `payer_settled`.
7. **FR-7:** The following statuses are **active for duplicate purposes** — a receivable in any of these statuses **does** block a duplicate: `created`, `under_review`, `offer`, `approved`, `confirmed`, `processing`, `completed`, `overdue`.
8. **FR-8:** When checking for duplicates on update or submit, the receivable being edited must be excluded from the collision set (a draft updating its own metadata must not match itself).
9. **FR-9:** A database migration must add materialized columns (or equivalent) for the normalized identifying fields and a partial unique index scoped to active statuses, serving as a concurrency backstop. Application-layer check remains the primary, user-facing enforcement.
10. **FR-10:** Duplicate detection must not apply across different sellers — the same `billNumber` or `fiscalDocumentKey` may exist for two different sellers simultaneously.

## Technical Constraints

- Scope: backend only (`src/`). No frontend changes in this PRD.
- Migration required: materialized columns for duplicate key fields plus partial unique index on the `receivables` table.
- Must preserve existing API contract shape on `/v1/receivables` routes; only new `409` responses are added.
- Must follow the established dual-layer pattern used by the wallet module (application guard + DB index backstop).
- Identifying data currently lives in JSON (`receivableMetaData`); the migration must materialize key fields into queryable columns to support indexing.
- Soft-deleted receivables (`deletedAt IS NOT NULL`) must be excluded from duplicate checks and from the partial unique index.
- Algorithm, layer placement, and file structure will be defined in the Tech Spec.

## Out of Scope

- Frontend error handling or UX for duplicate messages.
- Automatic deduplication or merging of existing duplicate rows already in the database.
- Cross-seller duplicate detection (same bill submitted by two different sellers).
- Expiration or cleanup of stale `created` drafts.
- Duplicate detection on read-only routes (`GET`).
- Changes to the receivable status machine or RBAC matrix.

## Open Questions

- **OQ-1:** Which business key should be authoritative — `(sellerId, billNumber)`, `(sellerId, fiscalDocumentKey)`, or both enforced independently? — **Owner: product / risk team**
- **OQ-2:** Should `billNumber` be normalized to uppercase, lowercase, or case-sensitive trimmed comparison? — **Owner: product**
- **OQ-3:** Should `fiscalDocumentKey` be normalized to digits-only (44-char NF-e access key) or preserve alphanumeric document numbers for `fiscalDocumentType = 'other'`? — **Owner: product / compliance**
- **OQ-4:** Use a single error code (`receivable_already_exists`) or granular codes (`duplicate_bill_number`, `duplicate_fiscal_key`)? — **Owner: product + frontend**
- **OQ-5:** Should `overdue` count as active (blocking resubmission) or terminal (allowing resubmission)? Current assumption: active (FR-7), since `overdue` is non-terminal in the lifecycle and represents an outstanding obligation. — **Owner: product / risk team**
- **OQ-6:** Should a receivable with incomplete metadata (missing `billNumber` or `fiscalDocumentKey`) skip the duplicate check until those fields are present, or reject early? — **Owner: engineering (recommend: skip until field is present on write paths that set it)**
