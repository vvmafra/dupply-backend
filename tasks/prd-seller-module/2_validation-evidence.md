# Validation evidence — Task 2.0: Domain layer

## Changes made

- `src/domain/seller/types.ts`: SellerStatus, metadata types, SellerPublicView, EMPTY_* constants
- `src/domain/seller/errors.ts`: SellerError + all error codes
- `src/domain/seller/validators.ts`: CNPJ, CPF, phone, address, business relations, completeness validators
- `src/domain/seller/transitions.ts`: 5-transition state machine
- `src/domain/seller/policies.ts`: read, update, submit, transition, soft-delete, receivable guard policies
- `tests/domain/seller/*.test.ts`: validators, transitions, policies test matrix

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 130 passing
```

## Success criteria

- [x] All types and error codes defined
- [x] Test matrix scenarios covered
- [x] Illegal transitions throw `invalid_status_transition`
- [x] CNPJ/business-relations validation verified
- [x] No pre-existing tests broken

## Notes

None.
