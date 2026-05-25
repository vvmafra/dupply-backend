# Validation evidence — Task 6.0: Payer/system commands, magic-link port, and queries

## Changes made

- `src/application/payer/ports/magicLinkToken.ts`: stub `consumePayerMagicToken` + test helper encoder.
- Commands: `payerMagicLinkRespond`, `systemAdvanceSettlement`, `systemPayerSettlement`.
- Queries: `listReceivablesQuery`, `getReceivableQuery`.
- Deleted `src/application/receivable/commands/receivableCommands.ts`.
- Unit tests for all new handlers.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 182 passing
```

## Success criteria

- [x] Invalid magic-link token → `PayerError`
- [x] Magic-link accept → `approved → confirmed`
- [x] System advance `confirmed → processing → completed`
- [x] System payer settlement `overdue → payer_settled`
- [x] List as seller scoped to own rows
- [x] Get as payer → forbidden
- [x] Monolithic `receivableCommands.ts` deleted

## Notes

Magic-link stub uses base64url JSON until Module 4 ships token storage.
