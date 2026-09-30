# Task 5.0: Remove redundant domain policies and update application commands

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Now that the guard is the single enforcement point for coarse role checks on guarded seller routes (OQ-2 decision), `assertCanTransitionSellerStatus` and `assertCanSoftDeleteSeller` are redundant and are removed from `src/domain/seller/policies.ts`. Their call sites and imports are removed from the two application commands. As a further simplification, `executeSoftDeleteSeller` no longer needs an `actor` parameter and its signature is updated accordingly.

Depends on: _Task 3.0_

## Requirements

- FR-6: No duplication between guard and domain for guarded routes (OQ-2: guard is single enforcement point).
- Techspec Component 5: remove `assertCanTransitionSellerStatus` and `assertCanSoftDeleteSeller` from `policies.ts`.
- Techspec Component 6: remove calls, imports, and (for `softDelete`) the `actor` parameter from the two application commands.
- The remaining `assert*` functions in `policies.ts` (`assertCanReadSeller`, `assertCanUpdateSellerMetadata`, `assertCanSubmitForReview`, `assertSellerCanCreateReceivable`) must not be touched.

## Subtasks

- [ ] 5.1 Read `src/domain/seller/policies.ts` to understand all existing policy functions
- [ ] 5.2 Read `src/application/seller/commands/transitionSellerStatusCommand.ts` to understand current call and import
- [ ] 5.3 Read `src/application/seller/commands/softDeleteSellerCommand.ts` to understand current call, import, and `actor` parameter usage
- [ ] 5.4 Remove `assertCanTransitionSellerStatus` and `assertCanSoftDeleteSeller` from `src/domain/seller/policies.ts`
- [ ] 5.5 Remove the `assertCanTransitionSellerStatus` call and its import from `transitionSellerStatusCommand.ts`
- [ ] 5.6 Remove the `assertCanSoftDeleteSeller` call and its import from `softDeleteSellerCommand.ts`; remove the `actor` parameter from `executeSoftDeleteSeller` and simplify the signature
- [ ] 5.7 Update the `executeSoftDeleteSeller` call site in `sellers.ts` to remove the `actor` argument
- [ ] 5.8 Update or delete any tests that previously tested `assertCanTransitionSellerStatus`, `assertCanSoftDeleteSeller`, or the old `executeSoftDeleteSeller(deps, actor, id)` signature
- [ ] 5.9 Run `npm run lint` and `npm test` to confirm everything compiles and passes

## Implementation details

See **Techspec § Component 5 — Remove redundant domain policies** and **§ Component 6 — Remove calls in application commands**.

`executeSoftDeleteSeller` signature change:
```typescript
// Before
export async function executeSoftDeleteSeller(
  deps: AppDeps,
  actor: { role: AccountRole },
  sellerId: string,
): Promise<void>

// After
export async function executeSoftDeleteSeller(
  deps: AppDeps,
  sellerId: string,
): Promise<void>
```

The `actor.role` field on `TransitionSellerStatusInput` is intentionally **kept** because `assertSellerStatusTransition` (the state machine) still uses it to determine the actor kind (`reviewer` vs `admin`). Only the standalone policy assertion is removed — the input type is unchanged.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] `assertCanTransitionSellerStatus` does not exist anywhere in `src/`
- [ ] `assertCanSoftDeleteSeller` does not exist anywhere in `src/`
- [ ] `executeSoftDeleteSeller` no longer accepts an `actor` parameter
- [ ] Call site in `sellers.ts` updated to `executeSoftDeleteSeller(deps, request.params.id)`
- [ ] Remaining policy functions in `policies.ts` are untouched
- [ ] No pre-existing tests broken (tests for removed functions are deleted or updated)

## Relevant files

- `tasks/prd-roles-guard/prd.md` ← read first
- `tasks/prd-roles-guard/techspec.md` ← read first
- `src/domain/seller/policies.ts` ← modify
- `src/application/seller/commands/transitionSellerStatusCommand.ts` ← modify
- `src/application/seller/commands/softDeleteSellerCommand.ts` ← modify
- `src/routes/v1/sellers.ts` ← modify (update call site)
- `tests/domain/seller/policies.test.ts` ← modify (remove tests for deleted functions)
- `tests/application/seller/commands/softDeleteSellerCommand.test.ts` ← modify (update signature)
