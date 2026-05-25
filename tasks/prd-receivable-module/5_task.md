# Task 5.0: Lifecycle commands — submit, risk decision, seller decision

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implement the three user-driven lifecycle commands after draft creation: submit for review, risk analyst decision (offer/reprove), and seller decision (accept/reject offer). Every command calls `assertReceivableTransition` immediately before the DB update — no inline role checks.

Corresponds to **techspec § Component 8** (submit, riskDecision, sellerDecision rows).

Depends on: **2.0**, **3.0**, **4.0**

## Requirements

- FR-2: Submit only from `created` status (transition guard + policy)
- FR-3: Submit validates metadata completeness via `assertReceivableMetaDataComplete` before transition
- FR-4: Risk decision restricted via transition guard; `decision = "offer"` requires `proposedValue`; `decision = "reprove"` forbids `proposedValue`
- FR-5: Seller decision enforces ownership (`assertSellerOwnsReceivable`); only from `status = 'offer'`
- FR-10: All commands call `assertReceivableTransition(from, to, { kind: "user", role })` — role passed as `TransitionActor`, not checked inline
- Techspec: risk verb is `reprove` (not `reject`) for analyst rejection → `reproved`
- Techspec: seller `decision: "accept" | "reject"` maps to `approved` / `rejected`
- Unit/integration tests per command

## Subtasks

- [ ] 5.1 Create `src/application/receivable/commands/submitReceivableCommand.ts` (`executeSubmitReceivable`)
- [ ] 5.2 Create `src/application/receivable/commands/riskDecisionCommand.ts` (`executeRiskDecision`)
- [ ] 5.3 Create `src/application/receivable/commands/sellerDecisionCommand.ts` (`executeSellerDecision`)
- [ ] 5.4 Write unit tests `tests/application/receivable/submitReceivableCommand.test.ts`
- [ ] 5.5 Write unit tests `tests/application/receivable/riskDecisionCommand.test.ts`
- [ ] 5.6 Write unit tests `tests/application/receivable/sellerDecisionCommand.test.ts`
- [ ] 5.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "8. Application commands"** and **§ Test strategy — Integration commands**.

Risk decision input:

```typescript
export type RiskDecisionInput = {
  receivableId: string;
  actorRole: string;
  decision: "offer" | "reprove";
  proposedValue?: string;
};
```

Error codes:
- Offer without `proposedValue` → `PROPOSED_VALUE_REQUIRED`
- Reprove with `proposedValue` present → `PROPOSED_VALUE_FORBIDDEN`

Submit flow:
1. Load receivable; ownership check
2. `assertReceivableMetaDataComplete(row.receivableMetaData)`
3. `assertReceivableTransition(created, under_review, { kind: "user", role: "seller" })`
4. UPDATE status

Seller decision on non-owner receivable → `NOT_OWNER`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Submit with incomplete metadata → `INCOMPLETE_METADATA`
- [ ] Risk offer without `proposedValue` → error
- [ ] Risk reprove with `proposedValue` → error
- [ ] Seller decision on non-owner receivable → `NOT_OWNER`
- [ ] Successful submit transitions `created → under_review`
- [ ] Successful risk offer transitions `under_review → offer` with `proposedValue` set
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-module/prd.md` ← read first
- `tasks/prd-receivable-module/techspec.md` ← read first
- `src/application/receivable/commands/submitReceivableCommand.ts` ← create
- `src/application/receivable/commands/riskDecisionCommand.ts` ← create
- `src/application/receivable/commands/sellerDecisionCommand.ts` ← create
- `tests/application/receivable/submitReceivableCommand.test.ts` ← create
- `tests/application/receivable/riskDecisionCommand.test.ts` ← create
- `tests/application/receivable/sellerDecisionCommand.test.ts` ← create
