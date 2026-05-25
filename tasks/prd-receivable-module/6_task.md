# Task 6.0: Payer/system commands, magic-link port, and queries

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implement the remaining application layer: payer magic-link respond command, system settlement commands, magic-link token validation port (stub for Module 4), read queries (list + get), and delete the monolithic `receivableCommands.ts`.

Corresponds to **techspec § Components 8 (remaining), 9, 10**.

Depends on: **2.0**, **3.0**, **4.0**, **5.0**

## Requirements

- FR-6: `executePayerMagicLinkRespond` validates token via port; verifies `row.payerId === payload.payerId`; transitions `approved → confirmed | payer_rejected`
- FR-7: `executeListReceivables` scopes by role — seller sees own; `risk_analyst`/`risk_analyst_agent`/`admin` see all (limit 200)
- FR-8: `executeGetReceivable` applies `assertCanViewReceivable`; 404 if missing or soft-deleted
- FR-10: System commands use `{ kind: "system" }` actor for transitions
- Techspec: delete `executePayerConfirm` and `src/application/receivable/commands/receivableCommands.ts`
- Techspec: `consumePayerMagicToken` port stub for tests until Module 4 ships
- Techspec: `systemAdvanceSettlement` — `confirmed → processing` or `processing → completed`
- Techspec: `systemPayerSettlement` — `completed → payer_settled | overdue` or `overdue → payer_settled`
- Unit/integration tests per command and query

## Subtasks

- [ ] 6.1 Create `src/application/payer/ports/magicLinkToken.ts` with `consumePayerMagicToken` stub
- [ ] 6.2 Create `src/application/receivable/commands/payerMagicLinkRespondCommand.ts`
- [ ] 6.3 Create `src/application/receivable/commands/systemAdvanceSettlementCommand.ts`
- [ ] 6.4 Create `src/application/receivable/commands/systemPayerSettlementCommand.ts`
- [ ] 6.5 Create `src/application/receivable/queries/listReceivablesQuery.ts`
- [ ] 6.6 Create `src/application/receivable/queries/getReceivableQuery.ts`
- [ ] 6.7 Delete `src/application/receivable/commands/receivableCommands.ts` and update any imports
- [ ] 6.8 Write unit tests for commands, port, and queries under `tests/application/`
- [ ] 6.9 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "8. Application commands"** (remaining rows), **§ "9. Application queries"**, **§ "10. Magic-link token validation port"**.

Magic-link port:

```typescript
export type MagicLinkTokenPayload = { receivableId: string; payerId: string };

export async function consumePayerMagicToken(
  deps: AppDeps,
  token: string,
): Promise<MagicLinkTokenPayload> {
  // Module 4: hash token, lookup payer_magic_tokens, check expiry/usedAt
  // throws PayerError on invalid/expired/used token
}
```

List query role scoping:

```typescript
if (actor.role === "seller") {
  // filter by sellerId === actor.profileId
}
if (actor.role === "admin" || actor.role === "risk_analyst" || actor.role === "risk_analyst_agent") {
  // all non-deleted, limit 200
}
// else → FORBIDDEN
```

System payer settlement body mapping (used by internal route in Task 8):
- `completed + settled → payer_settled`
- `completed + overdue → overdue`
- `overdue + settled → payer_settled`

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Payer magic-link respond with invalid token → 4xx from port
- [ ] Payer magic-link accept transitions `approved → confirmed`
- [ ] System advance transitions `confirmed → processing → completed`
- [ ] System payer settlement handles `overdue → payer_settled`
- [ ] List as seller returns only own receivables
- [ ] Get as payer returns forbidden
- [ ] Monolithic `receivableCommands.ts` deleted
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-module/prd.md` ← read first
- `tasks/prd-receivable-module/techspec.md` ← read first
- `src/application/payer/ports/magicLinkToken.ts` ← create
- `src/application/receivable/commands/payerMagicLinkRespondCommand.ts` ← create
- `src/application/receivable/commands/systemAdvanceSettlementCommand.ts` ← create
- `src/application/receivable/commands/systemPayerSettlementCommand.ts` ← create
- `src/application/receivable/queries/listReceivablesQuery.ts` ← create
- `src/application/receivable/queries/getReceivableQuery.ts` ← create
- `src/application/receivable/commands/receivableCommands.ts` ← delete
- `tests/application/receivable/*.test.ts` ← create or modify
