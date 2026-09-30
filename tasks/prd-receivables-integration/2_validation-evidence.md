# Validation evidence — Task API-6: Update API.md for receivables v2

## Changes made

- `API.md`: replaced legacy receivables section (`payerUserId`, create → `under_review`, `/confirm`, `reject` verb) with v2 contract aligned to `src/routes/v1/receivables.ts` — draft create, PATCH, submit, atomic create+submit, risk-decision, seller-decision, role-scoped list/detail, centavos money note, and known error codes.
- `API.md`: updated receivable lifecycle smoke checklist — payer resolved by CNPJ, example draft create curl.
- `tasks/prd-receivables-integration/tasks.md`: marked API-6 done.

## Test results

```
npm run lint → (doc-only change; no code modified)
npm test → (doc-only change; no code modified)
```

## Success criteria

- [x] `API.md` documents all public receivable routes from `receivables.ts` — GET list/detail, POST create, POST submit (atomic), PATCH, POST :id/submit, risk-decision, seller-decision.
- [x] Legacy `/confirm` and `payerUserId` removed from docs.
- [x] Known errors documented: `seller_not_active`, `incomplete_metadata`, `metadata_locked`, `seller_and_payer_must_differ`, `proposed_value_required_for_offer`, `invalid_receivable_transition`.
- [x] Role scoping matches code: seller own vs admin/risk_analyst/risk_analyst_agent all.

## Notes

- Error code in code is `proposed_value_required_for_offer` (not shorthand `proposed_value_required`); documented with actual string from `RECEIVABLE_ERROR_CODES`.
- `POST /v1/receivables/submit` included — shipped in API-1, part of real HTTP surface.
- No backend `techspec.md` or `2_task.md` existed for this PRD folder; requirements taken from frontend PRD API-6 row and user task description.
