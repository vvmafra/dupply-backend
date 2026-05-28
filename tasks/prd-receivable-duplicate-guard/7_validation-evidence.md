# Validation evidence — Task 7.0: HTTP 409 mapping and route tests

## Changes made

- `src/routes/v1/receivables.ts`: mapped `DUPLICATE_BILL_NUMBER` and `DUPLICATE_FISCAL_KEY` to HTTP 409
- `tests/routes/v1/receivables.test.ts`: four write-path duplicate route tests

## Test results

```
npm test → ✅ 274 passing
```

## Success criteria

- [x] `POST /v1/receivables` duplicate → 409 `{ error: "duplicate_bill_number" }`
- [x] `POST /v1/receivables/submit` duplicate → 409
- [x] `PATCH /v1/receivables/:id` duplicate → 409
- [x] `POST /v1/receivables/:id/submit` duplicate → 409
- [x] Non-duplicate errors retain existing status codes

## Notes

Submit route duplicate test uses direct metadata JSON update (same pattern as task 6) to avoid partial unique index violation while still asserting HTTP 409 mapping.
