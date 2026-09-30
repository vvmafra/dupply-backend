# Validation evidence — Task 6.0: Documentation updates + integration test sweep

## Changes made

- `API.md`: lifecycle v2 (10 statuses), breaking-change note (`approved` → `confirmed` after seller accept), registry trigger on `confirmed`, deprecated magic-link route (410).
- `.cursor/rules/module-receivables.mdc`: already aligned — 10-status diagram, RBAC matrix, routes table, registry trigger on `confirmed`, legacy statuses, deprecated magic-link route (verified, no further edits required).
- `.cursor/rules/module-payer.mdc`: already aligned — informational notification on `confirmed`, deprecated confirm flow (verified, no further edits required).
- `.cursor/rules/entities-overview.mdc`: expanded payer interaction note — informational email on `confirmed`, no magic-link gate, 410 on deprecated route.
- `tests/routes/v1/receivables.test.ts`: integration test `POST seller-decision accept` → 200; GET receivable shows `confirmed`.
- `tests/routes/v1/receivable-internal.test.ts`: full lifecycle E2E `full lifecycle without payer magic-link gate` (create → submit → offer → seller accept → internal advance → payer settlement).
- `tests/application/receivable/systemAdvanceSettlementCommand.test.ts`: assert `confirmed` status before system advance.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 282 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — `tsc -p tsconfig.json` exit 0.
- [x] Full test suite passes (`npm test`) — 282 tests, 0 failures.
- [x] `API.md` reflects 10-status lifecycle and deprecated magic-link route — lifecycle v2 section + breaking-change note + payers 410 route.
- [x] Cursor rules document `confirmed` as registry trigger point — `module-receivables.mdc` § "Relação com tokenização (Módulo 7)".
- [x] No integration tests reference `approved` as an active transition target — remaining `approved` references are legacy-path unit tests only (`transitions.test.ts`, `businessKey.test.ts`).
- [x] Full lifecycle E2E passes without magic-link step — `receivable-internal.test.ts` full lifecycle test.
- [x] No pre-existing tests broken — full suite green.

## Notes

- Documentation files (`API.md`, `module-receivables.mdc`, `module-payer.mdc`) were largely updated during tasks 3–4; task 6 verified alignment and added breaking-change / entities-overview payer notes plus missing integration coverage per techspec § Test strategy.
- Registry/tokenization runtime hook on `confirmed` remains deferred to Module 7 (OQ-4); documented only, no `src/` wiring in this feature.
