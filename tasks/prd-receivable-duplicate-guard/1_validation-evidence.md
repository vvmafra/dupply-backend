# Validation evidence — Task 1.0: Domain business key normalization and duplicate error codes

## Changes made

- `src/domain/receivable/businessKey.ts`: normalization helpers, status sets, materialized key derivation
- `src/domain/receivable/errors.ts`: added `DUPLICATE_BILL_NUMBER` and `DUPLICATE_FISCAL_KEY` codes
- `tests/domain/receivable/businessKey.test.ts`: unit tests per techspec table

## Test results

```
npm test (businessKey.test.ts) → ✅ 10 passing
npm run lint → ⚠️ pre-existing errors in src/db/transaction.ts (unrelated to this task)
```

## Success criteria

- [x] Code compiles for changed files — verified via test runner (tsx)
- [x] Unit tests pass — 10/10 businessKey tests
- [x] Bill number `" dup-001 "` → `"DUP-001"`
- [x] Fiscal key nfe strips non-digits; `other` preserves alphanumeric
- [x] Empty/missing fields → null materialized keys
- [x] `isDuplicateBlockingStatus`: true for `under_review`, false for `reproved`
- [x] No pre-existing tests broken — full suite 274 passing after all tasks

## Notes

Lint (`tsc`) fails on pre-existing `src/db/transaction.ts` type errors; not introduced by this task.
