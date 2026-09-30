# Task 1.0: Domain transitions rewrite — 10-status machine + legacy statuses

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Rewrite the receivable status machine to remove the payer confirmation gate: seller accept transitions `offer → confirmed` (not `offer → approved`), retire `approved` and `payer_rejected` from active statuses, remove the `payer_magic_link` transition actor, and add `LEGACY_RECEIVABLE_STATUSES` so historical DB rows remain readable via GET.

Corresponds to **techspec § Component 1 — Domain transitions**.

Depends on: **none**

## Requirements

- FR-1: Seller accept must allow `offer → confirmed` (replacing `offer → approved`)
- FR-2: Seller reject must continue to allow `offer → rejected` unchanged
- FR-3: Remove `approved` and `payer_rejected` from `RECEIVABLE_STATUS` and all transition rules
- FR-4: `payer_magic_link` actor must no longer authorize any status transition
- FR-5: System-only transitions from `confirmed` onward remain unchanged
- FR-11: `assertReceivableTransition` remains the single guard — no inline role checks elsewhere
- Techspec: `LEGACY_RECEIVABLE_STATUSES` for historical `approved` / `payer_rejected` values (OQ-3)
- Techspec: `isReceivableStatus` accepts both active and legacy values for API serialization

## Subtasks

- [x] 1.1 Read `src/domain/receivable/transitions.ts` and `tests/domain/receivable/transitions.test.ts` to understand the current 12-status machine
- [x] 1.2 Remove `APPROVED` and `PAYER_REJECTED` from `RECEIVABLE_STATUS`; add `LEGACY_RECEIVABLE_STATUSES`
- [x] 1.3 Remove `payer_magic_link` from `TransitionActor`; update seller branch to allow `offer → confirmed | rejected`
- [x] 1.4 Remove the entire `payer_magic_link` block from `assertReceivableTransition`
- [x] 1.5 Update `isReceivableStatus` to accept legacy values
- [x] 1.6 Rewrite `tests/domain/receivable/transitions.test.ts` per techspec test strategy table
- [x] 1.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "1. Domain transitions"** and **§ Test strategy — Unit assertReceivableTransition**.

After rewrite, `RECEIVABLE_STATUS` has exactly 10 active statuses:

`created`, `under_review`, `reproved`, `offer`, `rejected`, `confirmed`, `processing`, `completed`, `payer_settled`, `overdue`.

Seller branch in `assertReceivableTransition`:

```typescript
if (from === RECEIVABLE_STATUS.OFFER) {
  if (to === RECEIVABLE_STATUS.CONFIRMED || to === RECEIVABLE_STATUS.REJECTED) {
    if (!isSellerRole(role)) throw new ReceivableTransitionError("seller_role_required");
    return;
  }
}
```

Removed paths that must throw `ReceivableTransitionError`:
- `offer → approved` (seller)
- Any transition with `{ kind: "payer_magic_link" }` actor

System settlement transitions (`confirmed → processing → completed → payer_settled | overdue`, `overdue → payer_settled`) must remain unchanged.

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] `RECEIVABLE_STATUS` has exactly 10 active statuses
- [x] Seller accept `offer → confirmed` passes; `offer → approved` throws
- [x] Seller reject `offer → rejected` passes
- [x] Any `payer_magic_link` actor transition throws
- [x] System settlement transitions pass unchanged
- [x] `isReceivableStatus("payer_rejected")` returns `true` (legacy readable)
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-remove-payer-confirmation/prd.md` ← read first
- `tasks/prd-receivable-remove-payer-confirmation/techspec.md` ← read first
- `src/domain/receivable/transitions.ts` ← modify
- `tests/domain/receivable/transitions.test.ts` ← modify
