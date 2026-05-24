# Task 5.0: Status transition + soft delete commands

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implements two application commands: `executeTransitionSellerStatus` (admin/risk_analyst approve, reject, deactivate, reactivate) and `executeSoftDeleteSeller` (admin-only logical removal). The approval path (`in_review → active`) leaves a `@todo` hook for wallet creation — the wallet module is out of scope in this delivery. Soft delete sets `deletedAt` without physically removing the row.

Corresponds to **techspec component 6**.

Depends on: _1.0, 2.0_

## Requirements

- `executeTransitionSellerStatus`: validates actor role (`assertCanTransitionSellerStatus`), loads seller, validates transition (`assertSellerStatusTransition`), updates `status` and `updatedAt` in a transaction; leaves a `@todo(wallet-module)` comment when approving (`in_review → active`) (FR-11, FR-12, FR-13, FR-17)
- `executeSoftDeleteSeller`: validates actor is admin (`assertCanSoftDeleteSeller`), sets `deletedAt = NOW()` and `updatedAt = NOW()` only for rows where `deletedAt IS NULL` (idempotent guard) (FR-15)
- All four allowed status transitions covered: approve (`in_review → active`), reject (`in_review → inactive`), deactivate (`active → inactive`), reactivate (`inactive → active`)
- Illegal transitions (e.g., `created → active`) → `409 invalid_status_transition`
- Non-admin calling transition → `403 forbidden`

## Subtasks

- [ ] 5.1 Read `src/application/seller/sellerHelpers.ts` created in task 4 to reuse `loadSellerOrThrow`
- [ ] 5.2 Create `src/application/seller/commands/transitionSellerStatusCommand.ts`
- [ ] 5.3 Create `src/application/seller/commands/softDeleteSellerCommand.ts`
- [ ] 5.4 Write unit tests `tests/application/seller/transitionSellerStatusCommand.test.ts` covering all four valid transitions plus forbidden and illegal cases
- [ ] 5.5 Write unit tests `tests/application/seller/softDeleteSellerCommand.test.ts` covering: admin succeeds, non-admin → 403, already-deleted row not double-deleted
- [ ] 5.6 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "6. Application — status transitions and soft delete"**.

```typescript
// transitionSellerStatusCommand.ts
export async function executeTransitionSellerStatus(
  deps: AppDeps,
  input: { sellerId: string; targetStatus: "active" | "inactive"; actor: { role: AccountRole } },
): Promise<void> {
  assertCanTransitionSellerStatus(input.actor);
  const seller = await loadSellerOrThrow(deps, input.sellerId);
  const from = seller.status as SellerStatus;
  const actorKind =
    from === "in_review"
      ? { kind: "reviewer" as const, role: input.actor.role as "admin" | "risk_analyst" }
      : { kind: "admin" as const };
  assertSellerStatusTransition(from, input.targetStatus, actorKind);

  await deps.db.transaction(async (tx) => {
    await tx.update(sellers)
      .set({ status: input.targetStatus, updatedAt: new Date() })
      .where(eq(sellers.id, input.sellerId));

    if (from === "in_review" && input.targetStatus === "active") {
      // @todo(wallet-module): create wallet and SET wallet_id = <walletId>
    }
  });
}
```

```typescript
// softDeleteSellerCommand.ts
export async function executeSoftDeleteSeller(
  deps: AppDeps,
  actor: { role: AccountRole },
  sellerId: string,
): Promise<void> {
  assertCanSoftDeleteSeller(actor);
  const now = new Date();
  await deps.db.update(sellers)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(sellers.id, sellerId), isNull(sellers.deletedAt)));
}
```

**Observability requirement:** log `sellerId`, `fromStatus`, `toStatus`, and `actorRole` at `info` level on status transitions. Log `sellerId` at `info` on soft delete. Never log metadata with PII (CNPJ, CPF, phone) at `debug` in production configs.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Admin can approve (`in_review → active`), reject (`in_review → inactive`), deactivate (`active → inactive`), reactivate (`inactive → active`)
- [ ] `risk_analyst` actor receives `403 forbidden` for transition in v1 (v1 admin-only enforcement)
- [ ] Non-admin (e.g., seller role) calling transition → `403 forbidden`
- [ ] `created → active` → `409 invalid_status_transition`
- [ ] Soft delete sets `deletedAt` for an existing seller
- [ ] Soft delete on already-deleted seller is a no-op (no error, no double-write)
- [ ] Admin soft-deletes; non-admin → `403 forbidden`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-seller-module/prd.md` ← read first
- `tasks/prd-seller-module/techspec.md` ← read first
- `src/application/seller/commands/transitionSellerStatusCommand.ts` ← create
- `src/application/seller/commands/softDeleteSellerCommand.ts` ← create
- `src/application/seller/sellerHelpers.ts` ← read/modify if needed
- `tests/application/seller/transitionSellerStatusCommand.test.ts` ← create
- `tests/application/seller/softDeleteSellerCommand.test.ts` ← create
