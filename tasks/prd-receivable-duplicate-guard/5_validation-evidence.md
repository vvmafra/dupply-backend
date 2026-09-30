# Validation evidence — Task 5.0: Wire guard into create commands

## Changes made

- `src/application/receivable/commands/createReceivableCommand.ts`: guard + materialized columns + unique violation mapping
- `src/application/receivable/commands/createAndSubmitReceivableCommand.ts`: same pattern
- Extended create command tests for duplicate, resubmission after reproved, casing variant

## Test results

```
npm test → ✅ 274 passing
```

## Success criteria

- [x] Second create same normalized bill → `duplicate_bill_number`
- [x] Create after terminal `reproved` succeeds
- [x] `"abc-1"` vs `" ABC-1 "` blocked
- [x] Create-and-submit duplicate throws duplicate error

## Notes

None.
