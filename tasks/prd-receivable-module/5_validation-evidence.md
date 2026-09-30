# Validation evidence — Task 5.0: Lifecycle commands — submit, risk decision, seller decision

## Changes made

- `src/application/receivable/commands/submitReceivableCommand.ts`
- `src/application/receivable/commands/riskDecisionCommand.ts` — `reprove` verb, proposedValue validation
- `src/application/receivable/commands/sellerDecisionCommand.ts`
- Unit tests for each command.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 182 passing
```

## Success criteria

- [x] Submit incomplete metadata → `INCOMPLETE_METADATA`
- [x] Risk offer without `proposedValue` → error
- [x] Risk reprove with `proposedValue` → error
- [x] Seller decision non-owner → `NOT_OWNER`
- [x] Successful submit → `under_review`
- [x] Successful risk offer → `offer` with `proposedValue`

## Notes

None.
