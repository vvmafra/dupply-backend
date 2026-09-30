# Task 2.0: Duplicate guard alignment — remove approved and payer_rejected from status sets

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Update duplicate-guard status constants so `approved` is no longer a blocking status and `payer_rejected` is no longer a terminal status for new receivables. Historical rows with `payer_rejected` remain non-blocking because that value is absent from the blocking list.

Corresponds to **techspec § Component 5 — Duplicate guard**.

Depends on: **1.0**

## Requirements

- FR-8: `DUPLICATE_BLOCKING_STATUSES` must no longer include `approved`; `confirmed` remains blocking
- FR-8: `DUPLICATE_TERMINAL_STATUSES` must no longer include `payer_rejected` for new receivables
- Techspec: historical `payer_rejected` rows still non-blocking (not in BLOCKING list)

## Subtasks

- [ ] 2.1 Read `src/domain/receivable/businessKey.ts` and existing tests (if any)
- [ ] 2.2 Remove `RECEIVABLE_STATUS.APPROVED` from `DUPLICATE_BLOCKING_STATUSES`
- [ ] 2.3 Remove `RECEIVABLE_STATUS.PAYER_REJECTED` from `DUPLICATE_TERMINAL_STATUSES`
- [ ] 2.4 Update or create `tests/domain/receivable/businessKey.test.ts` per techspec test table
- [ ] 2.5 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "5. Duplicate guard"** and **§ Test strategy — Unit duplicate guard constants**.

Expected `DUPLICATE_BLOCKING_STATUSES`:

```typescript
[
  RECEIVABLE_STATUS.CREATED,
  RECEIVABLE_STATUS.UNDER_REVIEW,
  RECEIVABLE_STATUS.OFFER,
  RECEIVABLE_STATUS.CONFIRMED,
  RECEIVABLE_STATUS.PROCESSING,
  RECEIVABLE_STATUS.COMPLETED,
  RECEIVABLE_STATUS.OVERDUE,
]
```

Expected `DUPLICATE_TERMINAL_STATUSES`:

```typescript
[
  RECEIVABLE_STATUS.REPROVED,
  RECEIVABLE_STATUS.REJECTED,
  RECEIVABLE_STATUS.PAYER_SETTLED,
]
```

After task 1.0, `RECEIVABLE_STATUS.APPROVED` and `RECEIVABLE_STATUS.PAYER_REJECTED` no longer exist — ensure no references remain in `businessKey.ts`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] `DUPLICATE_BLOCKING_STATUSES` does not include `approved`
- [ ] `DUPLICATE_TERMINAL_STATUSES` does not include `payer_rejected`
- [ ] `confirmed` is still in the blocking list
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-remove-payer-confirmation/prd.md` ← read first
- `tasks/prd-receivable-remove-payer-confirmation/techspec.md` ← read first
- `src/domain/receivable/businessKey.ts` ← modify
- `tests/domain/receivable/businessKey.test.ts` ← create or modify
