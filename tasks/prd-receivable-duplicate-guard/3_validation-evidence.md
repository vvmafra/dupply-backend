# Validation evidence — Task 3.0: Application duplicate guard

## Changes made

- `src/application/receivable/duplicateGuard.ts`: `assertNoActiveReceivableDuplicate`, `isReceivableUniqueViolation`
- `tests/application/receivable/duplicateGuard.test.ts`: guard scenarios per techspec

## Test results

```
npm test → ✅ 274 passing (includes 9 duplicateGuard tests)
```

## Success criteria

- [x] Both keys null → no throw
- [x] Active bill collision → `duplicate_bill_number`
- [x] Terminal `reproved` prior → no throw
- [x] `excludeReceivableId` self → no throw
- [x] Different seller → no throw
- [x] Soft-deleted row → no throw
- [x] `isReceivableUniqueViolation` maps index names

## Notes

None.
