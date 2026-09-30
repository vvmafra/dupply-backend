# Task 6.0: Documentation updates + integration test sweep

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Update public API docs, Cursor module rules, and remaining integration tests to reflect the simplified 10-status lifecycle, deprecated magic-link route, and registry trigger point on `confirmed`. Ensures FR-10 and FR-12 coverage for cross-cutting tests not owned by earlier tasks.

Corresponds to **techspec § Component 7 — Registry hook alignment**, **§ Component 8 — Documentation updates**, **§ Component 9 — Swagger summaries**, and remaining **§ Test strategy** items.

Depends on: **1.0**, **2.0**, **3.0**, **4.0**, **5.0**

## Requirements

- FR-10: `API.md`, Swagger summaries, and `.cursor/rules/module-receivables.mdc` document the simplified lifecycle (10 active statuses)
- FR-10: `.cursor/rules/module-payer.mdc` and `.cursor/rules/entities-overview.mdc` updated for informational notification and deprecated confirm flow
- FR-12: Integration tests for system advance, payer settlement, and duplicate guard updated; full lifecycle E2E has no magic-link step
- Techspec (OQ-4): Registry/tokenization trigger documented as `confirmed` (no runtime hook yet)

## Subtasks

- [ ] 6.1 Read `API.md`, `.cursor/rules/module-receivables.mdc`, `.cursor/rules/module-payer.mdc`, `.cursor/rules/entities-overview.mdc`
- [ ] 6.2 Update `API.md` — lifecycle `offer → confirmed | rejected`; remove payer magic-link gate; note deprecated 410 route
- [ ] 6.3 Update `.cursor/rules/module-receivables.mdc` — 10-status diagram, RBAC matrix, routes table; registry trigger on `confirmed`
- [ ] 6.4 Update `.cursor/rules/module-payer.mdc` — informational notification on `confirmed`; deprecate confirm flow
- [ ] 6.5 Update `.cursor/rules/entities-overview.mdc` — payer interaction note
- [ ] 6.6 Update remaining tests referencing `approved` or magic-link flow:
  - `tests/application/receivable/systemAdvanceSettlementCommand.test.ts`
  - `tests/application/receivable/systemPayerSettlementCommand.test.ts`
  - `tests/routes/v1/receivable-internal.test.ts`
  - Any E2E / integration lifecycle tests under `tests/`
- [ ] 6.7 Verify no TypeScript errors (`npm run lint`) and full test suite passes (`npm test`)

## Implementation details

Reference **techspec § "7. Registry / tokenization hook alignment"**, **§ "8. Documentation updates"**, **§ "9. Swagger / route summaries"**, and **§ Test strategy — Integration / API E2E**.

Documentation lifecycle (main flow):

1. `created → under_review` (seller submit)
2. `under_review → offer | reproved` (analyst)
3. `offer → confirmed | rejected` (seller decision)
4. `confirmed → processing → completed` (system)
5. `completed → payer_settled | overdue` (system / due date)

Integration test expectations:
- `POST seller-decision accept` → 200; GET receivable shows `confirmed`
- Internal advance-settlement from `confirmed` → unchanged happy path
- Full lifecycle: create → submit → risk offer → seller accept → internal advance → payer settlement (no magic-link step)

Breaking change note for API docs: clients expecting `approved` after seller accept must handle `confirmed`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Full test suite passes (`npm test`)
- [ ] `API.md` reflects 10-status lifecycle and deprecated magic-link route
- [ ] Cursor rules document `confirmed` as registry trigger point (replacing `approved`)
- [ ] No integration tests reference `approved` as an active transition target
- [ ] Full lifecycle E2E passes without magic-link step
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-remove-payer-confirmation/prd.md` ← read first
- `tasks/prd-receivable-remove-payer-confirmation/techspec.md` ← read first
- `API.md` ← modify
- `.cursor/rules/module-receivables.mdc` ← modify
- `.cursor/rules/module-payer.mdc` ← modify
- `.cursor/rules/entities-overview.mdc` ← modify
- `tests/application/receivable/systemAdvanceSettlementCommand.test.ts` ← modify
- `tests/application/receivable/systemPayerSettlementCommand.test.ts` ← modify
- `tests/routes/v1/receivable-internal.test.ts` ← modify
