# Task 4.0: Deprecate payer magic-link respond — delete command, 410 route

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Remove the payer magic-link respond application command and replace the HTTP route with a documented **410 Gone** deprecation response. Payer action no longer drives receivable lifecycle transitions.

Corresponds to **techspec § Component 4 — Deprecate payer magic-link respond**.

Depends on: **1.0**

## Requirements

- FR-4: `payer_magic_link` actor must no longer authorize transitions (handled in task 1.0)
- FR-4: Delete `payerMagicLinkRespondCommand`; route returns documented deprecation response
- Techspec (OQ-2): **410 Gone** with `error: "payer_confirmation_removed"` for one release cycle
- Techspec: Keep `src/application/payer/ports/magicLinkToken.ts` (Module 4 may reuse later)
- Techspec: Mark route `deprecated: true` in OpenAPI schema

## Subtasks

- [x] 4.1 Read `src/application/receivable/commands/payerMagicLinkRespondCommand.ts` and `src/routes/v1/payers.ts`
- [x] 4.2 Delete `src/application/receivable/commands/payerMagicLinkRespondCommand.ts`
- [x] 4.3 Replace magic-link respond handler in `payers.ts` with 410 Gone response (keep route + schema, mark deprecated)
- [x] 4.4 Delete `tests/application/receivable/payerMagicLinkRespondCommand.test.ts`
- [x] 4.5 Update `tests/routes/v1/payers.test.ts` — assert 410 with `payer_confirmation_removed`
- [x] 4.6 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "4. Deprecate payer magic-link respond"** and **§ Test strategy — Integration HTTP routes**.

410 response body:

```typescript
return reply.code(410).send({
  error: "payer_confirmation_removed",
  message:
    "Payer confirmation no longer gates receivable settlement. Seller acceptance moves the receivable to confirmed.",
});
```

OpenAPI schema must include `deprecated: true` and updated summary noting removal.

Optional (techspec §9): update `src/routes/v1/receivables.ts` seller-decision summary to `"Seller accepts or rejects analyst offer (accept → confirmed)"`.

Remove any imports of the deleted command from routes or other modules.

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] `POST /v1/payers/magic-link/respond` returns **410** with `payer_confirmation_removed`
- [x] `payerMagicLinkRespondCommand.ts` and its test file are deleted
- [x] `magicLinkToken.ts` port is retained
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-remove-payer-confirmation/prd.md` ← read first
- `tasks/prd-receivable-remove-payer-confirmation/techspec.md` ← read first
- `src/application/receivable/commands/payerMagicLinkRespondCommand.ts` ← delete
- `src/routes/v1/payers.ts` ← modify
- `src/routes/v1/receivables.ts` ← modify (optional summary tweak)
- `tests/application/receivable/payerMagicLinkRespondCommand.test.ts` ← delete
- `tests/routes/v1/payers.test.ts` ← modify
