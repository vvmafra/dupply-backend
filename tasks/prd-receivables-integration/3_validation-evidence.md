# Validation evidence — API-2: Normalize receivable money at HTTP boundary

## Changes made

- `src/application/receivable/receivableHelpers.ts`: `valueReaisToDbCentsText`, `valueDbCentsTextToReais`, `metaApiToStored`, `metaStoredToApi`, `mapReceivableMetaDataForApi`; `mapReceivableRow` applies `toReais` on `value`/`proposedValue` and metadata JSON.
- `src/domain/receivable/types.ts`: `ReceivableRow.value` / `proposedValue` typed as `number` (reais) in API responses.
- Commands (`create`, `createAndSubmit`, `updateDraft`, `riskDecision`): accept `number` reais; persist centavos text via `toCents`.
- `src/routes/v1/receivables.ts`: Zod `value` / `proposedValue` / `desiredAnticipationValue` as `number` with `.multipleOf(0.01)`.
- Tests, `API.md`, `.cursor/rules/module-receivables.mdc` aligned to `money.mdc`.

## Test results

```
npm run lint → ⚠️ 2 pre-existing errors in src/db/transaction.ts (unrelated to this task)
npm test → ✅ 246 passing
```

## Success criteria

- [x] API request/response uses reais `number` for `value`, `proposedValue`, `desiredAnticipationValue`
- [x] DB still stores centavos (`value`/`proposed_value` text; metadata JSON cents)
- [x] `toCents` / `toReais` from `src/shared/money.ts` used at application boundary
- [x] Lint and tests pass

## Notes

Breaking change for any client still sending centavos strings. Front PRD already tracks mapper migration on land.
