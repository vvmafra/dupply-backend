# Task 3.0: Seller decision command + payer notification port stub

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Update `sellerDecisionCommand` so seller accept transitions to `confirmed` instead of `approved`, and invoke a best-effort payer notification port after a successful DB write. Notification failure must not roll back the status transition or fail the HTTP command.

Corresponds to **techspec § Component 2 — Seller decision command** and **§ Component 3 — Payer notification port**.

Depends on: **1.0**

## Requirements

- FR-1: `decision: "accept"` must transition `offer → confirmed`
- FR-6: On entry to `confirmed` via seller accept, trigger best-effort informational payer notification
- FR-6: Notification failure must not fail the seller-decision command (catch + log at warn)
- Techspec (OQ-1): Port stub in this feature; Module 4 implements email transport later

## Subtasks

- [ ] 3.1 Read `src/application/receivable/commands/sellerDecisionCommand.ts` and its existing tests
- [ ] 3.2 Create `src/application/payer/ports/receivableNotification.ts` with no-op stub
- [ ] 3.3 Change accept target from `APPROVED` to `CONFIRMED` in `sellerDecisionCommand`
- [ ] 3.4 After successful DB update, call `notifyPayerReceivableConfirmed` when `to === CONFIRMED`; catch errors and log `payer_notification_failed`
- [ ] 3.5 Update `tests/application/receivable/sellerDecisionCommand.test.ts` — accept → `confirmed`, reject unchanged, notification failure does not fail command
- [ ] 3.6 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "2. Seller decision command"**, **§ "3. Payer notification port"**, and **§ Test strategy — Unit sellerDecisionCommand**.

Port stub pattern (same as `magicLinkToken.ts`):

```typescript
export async function notifyPayerReceivableConfirmed(
  _deps: AppDeps,
  _input: NotifyPayerReceivableConfirmedInput,
): Promise<void> {
  // no-op in v1; hook point for Module 4
}
```

Notification hook in command (after DB write):

```typescript
if (to === RECEIVABLE_STATUS.CONFIRMED) {
  try {
    await notifyPayerReceivableConfirmed(deps, {
      receivableId: input.receivableId,
      payerId: row.payerId,
    });
  } catch (err) {
    deps.logger?.warn?.({ err, receivableId: input.receivableId }, "payer_notification_failed");
  }
}
```

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Accept on `offer` sets DB status to `confirmed` (not `approved`)
- [ ] Reject on `offer` sets DB status to `rejected` (unchanged behavior)
- [ ] When notification stub throws, command still resolves and status remains `confirmed`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-receivable-remove-payer-confirmation/prd.md` ← read first
- `tasks/prd-receivable-remove-payer-confirmation/techspec.md` ← read first
- `src/application/receivable/commands/sellerDecisionCommand.ts` ← modify
- `src/application/payer/ports/receivableNotification.ts` ← create
- `tests/application/receivable/sellerDecisionCommand.test.ts` ← modify
