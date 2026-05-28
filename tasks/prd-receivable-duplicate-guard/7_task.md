# Task 7.0: HTTP 409 mapping and route-level duplicate tests

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Maps the new duplicate error codes to HTTP `409` in the receivables route handler so sellers receive machine-readable `{ error: "duplicate_bill_number" }` or `{ error: "duplicate_fiscal_document_key" }` responses. Adds or extends route tests covering all four write endpoints on duplicate attempts.

Corresponds to **techspec § Component 6 — HTTP error mapping** and **§ Test strategy — API / E2E**.

Depends on: **5.0**, **6.0**

## Requirements

- FR-4: `DUPLICATE_BILL_NUMBER` and `DUPLICATE_FISCAL_KEY` map to HTTP `409` in `RECEIVABLE_ERROR_HTTP`
- Response shape unchanged: `{ error: "<code>" }`
- API tests: duplicate on `POST /v1/receivables`, `POST /v1/receivables/submit`, `PATCH /v1/receivables/:id`, `POST /v1/receivables/:id/submit` all return `409` with correct error code
- No new info-level logs containing full `billNumber` or `fiscalDocumentKey` (PII)

## Subtasks

- [ ] 7.1 Read `src/routes/v1/receivables.ts` — existing `RECEIVABLE_ERROR_HTTP` and error handler pattern
- [ ] 7.2 Add `409` mappings for `duplicate_bill_number` and `duplicate_fiscal_document_key`
- [ ] 7.3 Extend `tests/routes/v1/receivableRoutes.test.ts` (or add focused cases) for all four write paths returning `409`
- [ ] 7.4 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "6. HTTP error mapping"**.

```typescript
const RECEIVABLE_ERROR_HTTP: Partial<Record<ReceivableErrorCode, number>> = {
  [RECEIVABLE_ERROR_CODES.DUPLICATE_BILL_NUMBER]: 409,
  [RECEIVABLE_ERROR_CODES.DUPLICATE_FISCAL_KEY]: 409,
};
```

End-to-end assertion examples from techspec:

- `POST /v1/receivables` duplicate → `409` + `{ error: "duplicate_bill_number" }`
- Same for `/v1/receivables/submit`, `PATCH /v1/receivables/:id`, `POST /v1/receivables/:id/submit`

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] All four seller write routes return `409` with granular duplicate error code on collision
- [ ] Non-duplicate errors retain existing status codes
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-duplicate-guard/prd.md` ← read first
- `tasks/prd-receivable-duplicate-guard/techspec.md` ← read first
- `src/routes/v1/receivables.ts` ← modify
- `src/domain/receivable/errors.ts` ← read
- `tests/routes/v1/receivableRoutes.test.ts` ← modify
