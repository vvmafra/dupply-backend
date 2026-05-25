# Validation evidence — Task 4.0: Payer upsert port + draft commands (create + update)

## Changes made

- `src/domain/payer/errors.ts`: `PayerError` codes.
- `src/application/payer/commands/upsertPayerByCnpj.ts`: OQ-3 preserve-existing upsert.
- `src/application/receivable/receivableHelpers.ts`: shared load/find helpers.
- `src/application/receivable/commands/createReceivableCommand.ts`: draft create with `profileId`, payer upsert, transition guard.
- `src/application/receivable/commands/updateReceivableDraftCommand.ts`: PATCH merge while `created`.
- Tests under `tests/application/payer/` and `tests/application/receivable/create*` / `update*`.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 182 passing
```

## Success criteria

- [x] Active seller creates draft with `sellerId` and `payerId`
- [x] Inactive seller → `SellerError NOT_ACTIVE`
- [x] Same CNPJ → `SELLER_PAYER_MUST_DIFFER`
- [x] Existing payer CNPJ reused without overwrite
- [x] Update on non-`created` → `METADATA_LOCKED`

## Notes

Default draft `value` is `"0"` when omitted (NOT NULL column).
