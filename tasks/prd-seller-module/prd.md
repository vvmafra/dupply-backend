# Product Requirements Document — Seller Module

## Overview

The Seller module represents the **cedente** (assignor) entity on the Dupply platform — a company that holds trade receivables and wants to anticipate them. Every seller is owned by exactly one `account` (role = seller) and will eventually be linked to exactly one `wallet` (created later, upon approval).

This module covers the full seller lifecycle: onboarding via a multi-step registration form, a status machine that governs data editing and receivable submission rights, and admin/risk-analyst review flows. It is the foundational entity on which future receivable submissions depend.

---

## Goals

- Enable companies to register as sellers through a structured, multi-step onboarding flow.
- Enforce data completeness before a seller can submit for review.
- Provide admin and risk analysts with the ability to approve, reject, or deactivate sellers.
- Prevent sellers from submitting receivables unless their status is `active`.

**Success metrics:**
- 100% of sellers in `active` status have all required metadata fields filled and validated.
- 0 receivables created by sellers with status other than `active`.
- Status transitions are only performed by authorized roles (seller, admin, or risk_analyst).
- All status transitions are persisted correctly and are auditable via `updatedAt`.

---

## User Stories

- As a **seller**, I want to fill in my company profile step by step so that I can submit my registration for review.
- As a **seller**, I want to see my current registration status so that I know whether I am waiting for approval, approved, or rejected.
- As an **admin or risk_analyst**, I want to review pending seller registrations (status = `in_review`) so that I can approve or reject them.
- As an **admin**, I want to deactivate an active seller so that they can no longer submit receivables.
- As an **admin**, I want to reactivate an inactive seller so that they can resume operations if the situation changes.
- As an **admin**, I want to soft-delete a seller so that their account is logically removed without destroying historical data.

**Main flow (seller registration):**
1. Seller creates an account via `POST /v1/auth/register` — an `account` (role = seller) and a `seller` record are created atomically with status `created`.
2. Seller fills in company metadata (Step 2 — Empresa).
3. Seller fills in legal representative metadata (Step 3 — Representante Legal).
4. Seller fills in business relations metadata — clients and suppliers (Step 4 — Clientes e Fornecedores).
5. Seller uploads documents (Step 5 — Documentos). *(Document upload is out of scope for this module; handled by a future documents module.)*
6. Seller confirms and submits the registration — status transitions to `in_review`. Editing is blocked from this point.
7. Admin or risk_analyst reviews the registration and either approves (→ `active`) or rejects (→ `inactive`).
8. Upon approval, a wallet is created and linked to the seller. *(Wallet creation is triggered as part of the approval flow; defined in the wallet module, which is a dependency.)*

---

## Core Features

1. **Seller profile read**
   - What it does: Returns the full seller profile including all metadata and current status.
   - Why it matters: Sellers need to see their own data; admins need to review profiles during the approval process.

2. **Seller metadata update**
   - What it does: Allows the seller to update `companyMetaData`, `legalRepresentativeMetaData`, and `businessRelationsMetaData` while status is `created`.
   - Why it matters: Sellers complete their registration across multiple sessions; editing must be free until they submit for review.

3. **Status transition — seller submits for review**
   - What it does: Transitions the seller from `created` to `in_review` once all required fields are complete and the seller confirms submission.
   - Why it matters: Locks the profile from further edits and queues it for analyst review.

4. **Status transition — admin/risk_analyst approves or rejects**
   - What it does: Transitions the seller from `in_review` to `active` (approved) or `inactive` (rejected).
   - Why it matters: The approval gate controls access to the receivables feature.

5. **Status transition — admin deactivates or reactivates**
   - What it does: Allows an admin to move a seller between `active` and `inactive` post-approval.
   - Why it matters: Operational control to suspend or restore sellers without deleting their data.

6. **Soft delete**
   - What it does: Sets `deletedAt` on the seller record, making it logically removed.
   - Why it matters: Preserves historical data and audit trails while preventing the seller from operating.

---

## Functional Requirements

1. **FR-1:** A seller record must be created atomically in the same database transaction as its associated `account` record (via `POST /v1/auth/register`). The seller's initial status must be `created`.

2. **FR-2:** The `accountId` field must be unique — one seller per account, enforced at the database level and validated in the application layer.

3. **FR-3:** A seller with status `created` may freely update `companyMetaData`, `legalRepresentativeMetaData`, and `businessRelationsMetaData`. Updates to these fields must be rejected for sellers in any other status.

4. **FR-4:** The `businessRelationsMetaData` field must be validated in the application layer: minimum 1 client and 1 supplier, maximum 5 clients and 5 suppliers.

5. **FR-5:** Monetary values (`shareCapital`, `annualRevenue`) must be stored as integers in BRL cents (following the `money.mdc` convention). The API must accept and return these values in cents.

6. **FR-6:** Phone fields (`phone` in `companyMetaData` and `legalRepresentativeMetaData`) must contain digits only (DDD + number, no formatting), e.g. `41999449944`.

7. **FR-7:** The CNPJ field must contain exactly 14 digits (no formatting). The CPF field must contain exactly 11 digits.

8. **FR-8:** The `foundingDate` field must follow ISO 8601 format (`YYYY-MM-DD`).

9. **FR-9:** The address `zipCode` must contain exactly 8 digits. The `state` field must contain exactly 2 characters (UF).

10. **FR-10:** Status transition from `created` → `in_review` must only be triggered by the seller (own account) and only after all required metadata fields are present and valid.

11. **FR-11:** Status transitions from `in_review` → `active` or `in_review` → `inactive` must only be performed by an `admin` or `risk_analyst`.

12. **FR-12:** Status transition from `active` → `inactive` (deactivation) must only be performed by an `admin`.

13. **FR-13:** Status transition from `inactive` → `active` (reactivation) must only be performed by an `admin`.

14. **FR-14:** Only sellers with status `active` may create receivables. The application layer must enforce this guard.

15. **FR-15:** Soft delete (`DELETE /v1/sellers/:id`) sets `deletedAt` to the current timestamp. This action must only be performed by an `admin`. A soft-deleted seller cannot create receivables.

16. **FR-16:** The `GET /v1/sellers/:id` endpoint must be accessible by the seller (own profile) or an `admin`. A `risk_analyst` must be able to list and view sellers with status `in_review`.

17. **FR-17:** The `walletId` field is nullable at seller creation. A wallet is created and linked to the seller as part of the approval flow (when status transitions to `active`). The wallet creation logic is owned by the wallet module (external dependency).

18. **FR-18:** Email notification to the seller on status changes (e.g. approved or rejected) is required but **deferred** — must not block this module's delivery. *(TODO: implement when notification infrastructure is available.)*

---

## Technical Constraints

- Scope: backend only (`src/`); no frontend changes in this deliverable.
- New migration required: `sellers` table as defined in `module-seller.mdc`.
- Seller creation must share the same database transaction as account creation (FR-1).
- Must not break the existing `/v1/auth/register` contract; seller creation is additive.
- The `risk_analyst` role is defined in a separate, upcoming module. Until that module exists, only `admin` can perform approval/rejection transitions in the implementation. The route design must accommodate `risk_analyst` as a future actor without requiring breaking changes.
- Document upload (Step 5 of onboarding) is out of scope; it belongs to a future documents module.
- Wallet creation on approval is out of scope for this module; the seller module only holds the nullable `walletId` FK. Wallet linking will be implemented as part of the approval command when the wallet module is ready.

---

## Out of Scope

- Document upload and document management (separate future module).
- Wallet creation and wallet management (wallet module — triggered on seller approval).
- `risk_analyst` role definition and its authentication (separate upcoming module).
- Email / push notification for status changes (deferred — TODO).
- Front-end implementation of the multi-step registration form.
- Any receivables-related logic beyond the `status = active` guard.

---

## Open Questions

- **OQ-1:** Should a `risk_analyst` also be able to view sellers with status other than `in_review` (e.g. `active` or `inactive`) for auditing purposes? — Owner: product / risk team.
- **OQ-2:** When the wallet module is ready and wallet creation is triggered on approval, should the entire approval + wallet-creation be atomic (single DB transaction) or eventual? — Owner: engineering lead.
- **OQ-3:** Is there a maximum number of times a seller can be reactivated (inactive → active) by an admin, or is this unrestricted? — Owner: product / compliance.
- **OQ-4:** Should soft-deleted sellers be excluded from all queries by default, or should admins have a dedicated view/filter to see deleted sellers? — Owner: product.
