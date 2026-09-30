# Task 3.0: State machine rewrite — 12-status transitions + unit tests

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Replace the prototype 6-status state machine with the full 12-status lifecycle. Add `payer_magic_link` actor kind and make `assertReceivableTransition` the single RBAC source for all status changes. Remove the obsolete `offer → confirmed` payer-JWT path from the prototype.

Corresponds to **techspec § Component 6 — State machine rewrite**.

Depends on: **2.0**

## Requirements

- FR-4: `under_review → offer | reproved` allowed for `risk_analyst` and `risk_analyst_agent`
- FR-5: `offer → approved | rejected` allowed for `seller`
- FR-6: `approved → confirmed | payer_rejected` allowed for `payer_magic_link` actor
- FR-10: `assertReceivableTransition(from, to, actor)` is the single guard — no inline role checks elsewhere
- Techspec: system-only transitions — `confirmed → processing → completed`, `completed → payer_settled | overdue`, `overdue → payer_settled`
- Techspec: rename risk rejection target from `rejected` to `reproved`; `rejected` reserved for seller refusal of offer
- Techspec: `payer_rejected` is terminal (no transitions out)
- Unit tests covering all 12 statuses, authorized actors, and representative unauthorized actors

## Subtasks

- [ ] 3.1 Read existing `src/domain/receivable/transitions.ts` to understand prototype patterns
- [ ] 3.2 Rewrite `RECEIVABLE_STATUS` with all 12 statuses
- [ ] 3.3 Add `TransitionActor` type with `system`, `user`, and `payer_magic_link` kinds
- [ ] 3.4 Implement `assertReceivableTransition` with full transition matrix and role checks
- [ ] 3.5 Remove obsolete payer-JWT `offer → confirmed` path
- [ ] 3.6 Rewrite `tests/domain/receivable/transitions.test.ts` for full coverage per techspec test strategy
- [ ] 3.7 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "6. State machine rewrite"** and **§ Test strategy — Unit assertReceivableTransition**.

Transition matrix summary:

| Actor | Transitions |
|-------|-------------|
| `user` (seller) | implicit → `created`; `created → under_review`; `offer → approved \| rejected` |
| `user` (risk_analyst / risk_analyst_agent) | `under_review → offer \| reproved` |
| `payer_magic_link` | `approved → confirmed \| payer_rejected` |
| `system` | `confirmed → processing`; `processing → completed`; `completed → payer_settled \| overdue`; `overdue → payer_settled` |

Terminal / no re-entry examples: `reproved → under_review` must throw; `payer_rejected → *` must throw.

OQ-1 resolved: `overdue` is recoverable via `overdue → payer_settled`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] All 12 statuses exist in `RECEIVABLE_STATUS`
- [ ] Seller cannot submit (`created → under_review`) as `risk_analyst` — throws
- [ ] Payer magic link accept/reject transitions pass for `payer_magic_link` actor
- [ ] System advance and payer settlement transitions pass for `system` actor
- [ ] Terminal re-entry (`reproved → under_review`) throws
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-module/prd.md` ← read first
- `tasks/prd-receivable-module/techspec.md` ← read first
- `src/domain/receivable/transitions.ts` ← modify
- `tests/domain/receivable/transitions.test.ts` ← modify
