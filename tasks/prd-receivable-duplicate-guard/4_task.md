# Task 4.0: Metadata persistence helpers (normalize + materialized keys)

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Extends receivable write helpers so every metadata persistence path normalizes identifying fields before JSON storage and exposes materialized business key values for INSERT/UPDATE column writes. Commands in tasks 5 and 6 will call these helpers before invoking the duplicate guard.

Corresponds to **techspec § Component 4a — receivableHelpers.ts**.

Depends on: **1.0**

## Requirements

- FR-5: Identifying fields normalized before comparison and persistence via `normalizeReceivableMetaDataForStorage`
- FR-1: `deriveMaterializedBusinessKeys` drives column values written alongside `receivableMetaData`
- `prepareReceivableMetaDataForWrite` returns `{ receivableMetaData, materializedKeys }`
- Update `stringifyReceivableMetaData` to delegate normalization so all legacy call paths persist normalized values

## Subtasks

- [ ] 4.1 Read `src/application/receivable/receivableHelpers.ts` and trace existing metadata stringify/parse usage across write commands
- [ ] 4.2 Add `prepareReceivableMetaDataForWrite` using `normalizeReceivableMetaDataForStorage` and `deriveMaterializedBusinessKeys`
- [ ] 4.3 Update `stringifyReceivableMetaData` to apply normalization consistently
- [ ] 4.4 Add or extend unit tests covering normalization on helper output (can live in existing helper test file or command tests if none exists)
- [ ] 4.5 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "4a. receivableHelpers.ts"**.

```typescript
export function prepareReceivableMetaDataForWrite(
  meta: Partial<ReceivableMetaData>,
): { receivableMetaData: string; materializedKeys: MaterializedBusinessKeys }
```

Flow: `metaApiToStored` → `normalizeReceivableMetaDataForStorage` → `JSON.stringify` + `deriveMaterializedBusinessKeys`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] `prepareReceivableMetaDataForWrite` returns uppercase bill number in JSON and matching `normalizedBillNumber`
- [ ] Incomplete metadata yields null materialized keys without throwing
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-duplicate-guard/prd.md` ← read first
- `tasks/prd-receivable-duplicate-guard/techspec.md` ← read first
- `src/application/receivable/receivableHelpers.ts` ← modify
- `src/domain/receivable/businessKey.ts` ← read
