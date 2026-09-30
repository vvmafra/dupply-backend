# Task 5.0: Wire guard into create and create-and-submit commands

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Integrates the duplicate guard and materialized key columns into the two seller create write paths: draft create (`POST /v1/receivables`) and create-and-submit (`POST /v1/receivables/submit`). Before insert, asserts no active duplicate; on insert, persists normalized metadata and materialized columns; catches DB unique violations and maps them to duplicate error codes.

Corresponds to **techspec § Component 4b and 4c — createReceivableCommand, createAndSubmitReceivableCommand**.

Depends on: **3.0**, **4.0**

## Requirements

- FR-3: Guard runs on create draft and create-and-submit before insert
- FR-5: Insert includes `normalizedBillNumber` and `normalizedFiscalDocumentKey` from `materializedKeys`
- FR-4: DB unique violation mapped to `duplicate_bill_number` or `duplicate_fiscal_document_key` via `isReceivableUniqueViolation`
- OQ-6: Skip guard when both materialized keys are null (incomplete metadata)
- Resubmission after terminal status (`reproved`, etc.) must succeed in integration tests

## Subtasks

- [ ] 5.1 Read `src/application/receivable/commands/createReceivableCommand.ts` and `createAndSubmitReceivableCommand.ts`
- [ ] 5.2 Wire `prepareReceivableMetaDataForWrite`, `assertNoActiveReceivableDuplicate`, materialized columns on insert, and try/catch for unique violations in both commands
- [ ] 5.3 Extend `tests/application/receivable/createReceivableCommand.test.ts` — duplicate blocked, terminal prior allows create, casing/whitespace variant blocked
- [ ] 5.4 Extend `tests/application/receivable/createAndSubmitReceivableCommand.test.ts` — duplicate on complete metadata returns duplicate error
- [ ] 5.5 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "4b. createReceivableCommand.ts"** and **§ "4c. createAndSubmitReceivableCommand.ts"**.

Pattern per create:

```typescript
await assertNoActiveReceivableDuplicate(deps, { sellerId, keys: materializedKeys });
try {
  await deps.db.insert(receivables).values({ /* + materialized columns */ });
} catch (error) {
  const violation = isReceivableUniqueViolation(error);
  // map to ReceivableError
}
```

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Second create with same normalized `billNumber` throws `duplicate_bill_number`
- [ ] Create after terminal `reproved` receivable with same keys succeeds
- [ ] `"abc-1"` vs `" ABC-1 "` treated as duplicate
- [ ] Create-and-submit with duplicate complete metadata throws duplicate error
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-duplicate-guard/prd.md` ← read first
- `tasks/prd-receivable-duplicate-guard/techspec.md` ← read first
- `src/application/receivable/commands/createReceivableCommand.ts` ← modify
- `src/application/receivable/commands/createAndSubmitReceivableCommand.ts` ← modify
- `src/application/receivable/duplicateGuard.ts` ← read
- `src/application/receivable/receivableHelpers.ts` ← read
- `tests/application/receivable/createReceivableCommand.test.ts` ← modify
- `tests/application/receivable/createAndSubmitReceivableCommand.test.ts` ← modify
