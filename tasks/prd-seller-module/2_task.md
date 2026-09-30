# Task 2.0: Domain layer — types, errors, validators, transitions, policies

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implements the entire pure-domain layer for the seller bounded context: TypeScript types, error codes, metadata validators, status-machine transitions, and authorization policies. Every function in this layer is a pure, side-effect-free assertion — no database I/O. This layer is the single source of truth for business rules; all application commands (tasks 3–6) import and rely on it.

Corresponds to **techspec component 3**.

Depends on: _1.0_

## Requirements

- `SellerStatus`, `CompanyMetaData`, `LegalRepresentativeMetaData`, `BusinessRelationsMetaData`, `SellerPublicView` types defined in `types.ts` (FR-3, FR-5)
- All error codes defined and mapped to HTTP status in `errors.ts` (codes: `seller_not_found`, `forbidden`, `metadata_locked`, `validation_error`, `incomplete_metadata`, `invalid_status_transition`, `invalid_status_for_submit`, `seller_not_active`)
- `validators.ts`: `assertValidCnpj` (14 digits), `assertValidCpf` (11 digits), `assertValidPhone` (digits only), `assertValidFoundingDate` (YYYY-MM-DD), `assertValidAddress` (zipCode 8 digits, state 2 chars), `assertValidBusinessRelations` (1–5 clients, 1–5 suppliers, CNPJ per relation), `assertCompleteSellerMetadata` (all required fields present + all validators) — FR-4, FR-6, FR-7, FR-8, FR-9
- `transitions.ts`: `assertSellerStatusTransition` enforcing the full 5-transition state machine (FR-10, FR-11, FR-12, FR-13)
- `policies.ts`: `assertCanReadSeller`, `assertCanUpdateSellerMetadata`, `assertCanSubmitForReview`, `assertCanTransitionSellerStatus`, `assertCanSoftDeleteSeller`, `assertSellerCanCreateReceivable` (FR-3, FR-10–FR-16)
- Unit tests covering all scenarios listed in techspec "Test strategy" for domain/seller

## Subtasks

- [ ] 2.1 Read an existing domain module (e.g., `src/domain/account/`) to understand naming, error, and export conventions
- [ ] 2.2 Create `src/domain/seller/types.ts` with all types and the `EMPTY_*` JSON default constants
- [ ] 2.3 Create `src/domain/seller/errors.ts` with `SELLER_ERROR_CODES` and `SellerError` class
- [ ] 2.4 Create `src/domain/seller/validators.ts` with all six pure validator functions
- [ ] 2.5 Create `src/domain/seller/transitions.ts` with `StatusTransitionActor` type and `assertSellerStatusTransition`
- [ ] 2.6 Create `src/domain/seller/policies.ts` with all six policy assertions
- [ ] 2.7 Write unit tests `tests/domain/seller/validators.test.ts`, `transitions.test.ts`, `policies.test.ts` covering all scenarios in the techspec test matrix
- [ ] 2.8 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "3. Domain — types, validators, transitions, policies"**.

### Status machine (normative)

```
created   → in_review   actor: seller (own accountId)
in_review → active      actor: admin | risk_analyst
in_review → inactive    actor: admin | risk_analyst
active    → inactive    actor: admin
inactive  → active      actor: admin
```

All other `(from, to)` pairs → throw `SellerError(SELLER_ERROR_CODES.INVALID_STATUS_TRANSITION)`.

### Policies — key constraints

- `assertCanReadSeller`: soft-deleted seller → `NOT_FOUND` for non-admin; `risk_analyst` only sees `in_review`; admin sees all
- `assertCanUpdateSellerMetadata`: own seller only, status must be `created` (→ `METADATA_LOCKED` otherwise)
- `assertCanTransitionSellerStatus`: v1 — admin only; `risk_analyst` branch present but returns `FORBIDDEN` until risk module ships
- `assertSellerCanCreateReceivable`: `deletedAt !== null` OR `status !== "active"` → `SELLER_NOT_ACTIVE`

### Validator rules

| Field | Rule | Error |
|-------|------|-------|
| cnpj | exactly 14 digits | `validation_error` |
| cpf | exactly 11 digits | `validation_error` |
| phone | digits only | `validation_error` |
| foundingDate | YYYY-MM-DD regex | `validation_error` |
| zipCode | exactly 8 digits | `validation_error` |
| state | exactly 2 chars | `validation_error` |
| clients/suppliers count | 1–5 each | `validation_error` |

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] All techspec test-matrix scenarios covered (validators, transitions, policies)
- [ ] `assertSellerStatusTransition("created", "active", { kind: "admin" })` throws `invalid_status_transition`
- [ ] `assertSellerStatusTransition("inactive", "active", { kind: "admin" })` passes
- [ ] `assertValidCnpj("12345678000195")` passes; `assertValidCnpj("1234567800019")` throws `validation_error`
- [ ] `assertValidBusinessRelations({ clients: [], suppliers: [{ legalName: "X", cnpj: "12345678000195" }] })` throws `validation_error`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-seller-module/prd.md` ← read first
- `tasks/prd-seller-module/techspec.md` ← read first
- `src/domain/seller/types.ts` ← create
- `src/domain/seller/errors.ts` ← create
- `src/domain/seller/validators.ts` ← create
- `src/domain/seller/transitions.ts` ← create
- `src/domain/seller/policies.ts` ← create
- `tests/domain/seller/validators.test.ts` ← create
- `tests/domain/seller/transitions.test.ts` ← create
- `tests/domain/seller/policies.test.ts` ← create
