# Validation evidence — Task 8.0: Payer magic-link route, internal settlement routes, server wiring

## Changes made

- `src/routes/v1/payers.ts`: public `POST /v1/payers/magic-link/respond`.
- `src/routes/v1/receivable-internal.ts`: added `payer-settlement`; `hide: true` on internal routes.
- `src/server.ts`: registered payers route in public scope (no JWT).
- `tests/routes/v1/payers.test.ts`, `receivable-internal.test.ts`.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 182 passing
```

## Success criteria

- [x] Magic-link respond without JWT
- [x] Internal routes without API key → 401
- [x] Internal routes use v2 system commands
- [x] Happy path: confirmed → advance → payer_settled via internal routes

## Notes

Full end-to-end lifecycle (create → patch → submit → risk → seller accept → magic-link → internal) covered across application + route tests.
