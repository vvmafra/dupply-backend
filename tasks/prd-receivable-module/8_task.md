# Task 8.0: Payer magic-link route, internal settlement routes, server wiring

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Wire the remaining HTTP surface: public payer magic-link respond route (no JWT), internal settlement routes behind API key, and register the new payers route in `server.ts`. Completes the end-to-end receivable lifecycle from payer response through system settlement.

Corresponds to **techspec § Components 12 and 13**.

Depends on: **6.0**, **7.0**

## Requirements

- FR-6: `POST /v1/payers/magic-link/respond` — public route (no bearer auth); body `{ token, decision: "accept" | "reject" }`; delegates to `executePayerMagicLinkRespond`
- FR-9: Internal routes require `X-Dupply-Api-Key`; hidden from public Swagger (`tags: ["Internal"], hide: true`)
- FR-9: `POST /v1/internal/receivables/:id/advance-settlement` — body `{ targetStatus: "processing" | "completed" }`
- FR-9: `POST /v1/internal/receivables/:id/payer-settlement` — body `{ outcome: "settled" | "overdue" }`
- FR-10: Internal routes delegate to system commands using `{ kind: "system" }` actor
- Techspec: register payers route in public scope (same pattern as auth routes — no `requireJwt`)
- Techspec: extend existing `src/routes/v1/receivable-internal.ts`
- Integration tests for payer route and internal routes

## Subtasks

- [ ] 8.1 Read `src/server.ts` and auth route registration pattern for public scope
- [ ] 8.2 Create `src/routes/v1/payers.ts` with magic-link respond route
- [ ] 8.3 Extend `src/routes/v1/receivable-internal.ts` — add `payer-settlement` route; verify `advance-settlement` uses v2 commands
- [ ] 8.4 Register payers route in `src/server.ts` (public scope, no JWT)
- [ ] 8.5 Write `tests/routes/v1/payers.test.ts` for magic-link respond
- [ ] 8.6 Update internal route tests — API key required; hidden Internal tag in Swagger
- [ ] 8.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "12. Payer magic-link route"**, **§ "13. Internal routes"**, and **§ Test strategy — Integration HTTP routes**.

Payer route schema:

```typescript
api.post("/v1/payers/magic-link/respond", {
  schema: {
    tags: ["Payers"],
    summary: "Payer accepts or rejects receivable via magic link token",
    security: [],  // no bearerAuth
    body: z.object({
      token: z.string().min(1),
      decision: z.enum(["accept", "reject"]),
    }),
  },
}, async (request, reply) => {
  await executePayerMagicLinkRespond(deps, {
    token: request.body.token,
    decision: request.body.decision,
  });
  return { ok: true };
});
```

Internal payer-settlement mapping:
- `completed + settled → payer_settled`
- `completed + overdue → overdue`
- `overdue + settled → payer_settled`

Happy-path integration test (from techspec): create → patch → submit → risk offer → seller accept → magic-link accept → internal advance → internal payer settlement.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit/integration tests pass (`npm test`)
- [ ] Magic-link respond route accessible without JWT
- [ ] Internal routes without API key → 401
- [ ] Internal routes hidden from public Swagger (Internal tag)
- [ ] Full happy-path lifecycle completes end to end
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-module/prd.md` ← read first
- `tasks/prd-receivable-module/techspec.md` ← read first
- `src/routes/v1/payers.ts` ← create
- `src/routes/v1/receivable-internal.ts` ← modify
- `src/server.ts` ← modify
- `tests/routes/v1/payers.test.ts` ← create
- `tests/routes/v1/receivable-internal.test.ts` ← create or modify
