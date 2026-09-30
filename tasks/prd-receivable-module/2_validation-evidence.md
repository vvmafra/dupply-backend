# Validation evidence — Task 2.0: Domain foundation — types, errors, metadata validation, policies

## Changes made

- `src/domain/receivable/types.ts`: `ReceivableMetaData` and `ReceivableRow` types.
- `src/domain/receivable/errors.ts`: `ReceivableError` with stable codes.
- `src/domain/receivable/metadata.ts`: `parseReceivableMetaData`, `assertReceivableMetaDataComplete`.
- `src/domain/receivable/policies.ts`: ownership, draft update, view ACL, CNPJ differ guards.
- `tests/domain/receivable/metadata.test.ts`, `policies.test.ts`: unit tests.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 182 passing
```

## Success criteria

- [x] Missing `dueDate` throws `INCOMPLETE_METADATA`
- [x] `antifraudDeclarationsAccepted: false` throws `INCOMPLETE_METADATA`
- [x] PATCH policy rejects non-`created` with `METADATA_LOCKED`
- [x] Same seller/payer CNPJ throws `SELLER_PAYER_MUST_DIFFER`
- [x] Payer role cannot view via `assertCanViewReceivable`

## Notes

None.
