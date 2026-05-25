# Validation evidence — Task 3.0: State machine rewrite — 12-status transitions + unit tests

## Changes made

- `src/domain/receivable/transitions.ts`: Full 12-status machine, `payer_magic_link` actor, implicit `→ created`.
- `tests/domain/receivable/transitions.test.ts`: Comprehensive transition coverage.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 182 passing
```

## Success criteria

- [x] All 12 statuses in `RECEIVABLE_STATUS`
- [x] Seller cannot submit as `risk_analyst`
- [x] Payer magic-link transitions pass for `payer_magic_link` actor
- [x] System advance and payer settlement transitions pass
- [x] Terminal re-entry `reproved → under_review` throws
- [x] Obsolete `offer → confirmed` payer-JWT path removed

## Notes

None.
