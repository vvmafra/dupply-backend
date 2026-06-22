# Validation evidence — Task 4.0: Deprecate payer magic-link respond — delete command, 410 route

## Changes made

- `src/application/receivable/commands/payerMagicLinkRespondCommand.ts`: already deleted (no references remain in `src/` or `tests/`).
- `src/routes/v1/payers.ts`: route `POST /v1/payers/magic-link/respond` returns **410 Gone** with `error: "payer_confirmation_removed"`; OpenAPI schema marked `deprecated: true` with updated summary.
- `tests/application/receivable/payerMagicLinkRespondCommand.test.ts`: already deleted.
- `tests/routes/v1/payers.test.ts`: asserts 410 with `payer_confirmation_removed` for valid and invalid token payloads.
- `src/routes/v1/receivables.ts`: seller-decision summary updated to `"Seller accepts or rejects analyst offer (accept → confirmed)"` (techspec §9).
- `src/application/payer/ports/magicLinkToken.ts`: retained unchanged for potential Module 4 reuse.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 280 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — `tsc -p tsconfig.json` exit 0.
- [x] Unit tests pass (`npm test`) — 280/280 passing.
- [x] `POST /v1/payers/magic-link/respond` returns **410** with `payer_confirmation_removed` — covered by `tests/routes/v1/payers.test.ts`.
- [x] `payerMagicLinkRespondCommand.ts` and its test file are deleted — confirmed via glob and grep; no imports remain.
- [x] `magicLinkToken.ts` port is retained — file present at `src/application/payer/ports/magicLinkToken.ts`.
- [x] No pre-existing tests broken — full suite green.

## Notes

Implementation was largely present before this task run (command and command tests already removed; route already returning 410). This session verified completeness, applied the optional receivables seller-decision summary tweak, and recorded validation evidence.
