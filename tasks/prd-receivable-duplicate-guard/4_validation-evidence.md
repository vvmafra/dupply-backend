# Validation evidence — Task 4.0: Metadata persistence helpers

## Changes made

- `src/application/receivable/receivableHelpers.ts`: `prepareReceivableMetaDataForWrite`, normalized `stringifyReceivableMetaData`
- `tests/application/receivable/receivableHelpers.test.ts`: helper output tests

## Test results

```
npm test → ✅ 274 passing (includes 2 receivableHelpers tests)
```

## Success criteria

- [x] `prepareReceivableMetaDataForWrite` uppercases bill in JSON and materialized key
- [x] Incomplete metadata → null keys without throw
- [x] No pre-existing tests broken

## Notes

None.
