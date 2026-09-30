# Task 6.0: Wire guard into update draft and submit commands

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Integrates the duplicate guard into draft update (`PATCH /v1/receivables/:id`) and submit (`POST /v1/receivables/:id/submit`). Update runs the guard only when metadata patch may change identifying fields, excluding self. Submit validates complete metadata keys against other active receivables before status transition, also excluding self.

Corresponds to **techspec § Component 4d and 4e — updateReceivableDraftCommand, submitReceivableCommand**.

Depends on: **3.0**, **4.0**

## Requirements

- FR-3: Guard on draft update when `receivableMetaData` is provided; guard on submit even when metadata unchanged
- FR-8: Pass `excludeReceivableId: input.receivableId` on update and submit
- FR-5: UPDATE sets normalized JSON and materialized columns when metadata patched
- FR-3: PATCH updating unrelated fields must not trigger duplicate check when `receivableMetaData` is undefined
- Submit: derive keys from `assertReceivableMetaDataComplete` row metadata before guard

## Subtasks

- [ ] 6.1 Read `src/application/receivable/commands/updateReceivableDraftCommand.ts` and `submitReceivableCommand.ts`
- [ ] 6.2 Wire guard, materialized columns, and unique-violation mapping in `updateReceivableDraftCommand`
- [ ] 6.3 Wire guard (exclude self) in `submitReceivableCommand` before `created → under_review` transition
- [ ] 6.4 Extend `tests/application/receivable/updateReceivableDraftCommand.test.ts` — collide on bill change, no guard on unrelated patch
- [ ] 6.5 Extend `tests/application/receivable/submitReceivableCommand.test.ts` — submit blocked when keys collide with another active receivable
- [ ] 6.6 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "4d. updateReceivableDraftCommand.ts"** and **§ "4e. submitReceivableCommand.ts"**.

Update guard runs only when `input.receivableMetaData !== undefined`. When metadata not patched, reuse existing row keys via `deriveMaterializedBusinessKeys(parseReceivableMetaData(row.receivableMetaData))` without calling guard.

Submit does not change metadata but must still block duplicate active receivables sharing the same keys.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] PATCH changing `billNumber` to collide with another active receivable throws duplicate error
- [ ] PATCH updating only unrelated field does not invoke duplicate guard
- [ ] Submit with keys colliding against another active receivable throws duplicate error
- [ ] Update/submit of same draft with unchanged identifying fields does not self-collide
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-duplicate-guard/prd.md` ← read first
- `tasks/prd-receivable-duplicate-guard/techspec.md` ← read first
- `src/application/receivable/commands/updateReceivableDraftCommand.ts` ← modify
- `src/application/receivable/commands/submitReceivableCommand.ts` ← modify
- `src/application/receivable/duplicateGuard.ts` ← read
- `src/application/receivable/receivableHelpers.ts` ← read
- `tests/application/receivable/updateReceivableDraftCommand.test.ts` ← modify
- `tests/application/receivable/submitReceivableCommand.test.ts` ← modify
