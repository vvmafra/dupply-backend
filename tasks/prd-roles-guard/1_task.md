# Task 1.0: Expand `AccountRole` to include all v1 platform roles

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Expand the `ACCOUNT_ROLES` constant in `src/domain/account/types.ts` to include `payer` and `risk_analyst_agent`, making it the single source of truth for all five v1 platform roles. This eliminates the divergence with `PlatformRole` in `domain/receivable/transitions.ts` and enables `requireRoles` (Task 2) to accept any valid platform role at the type level without a secondary type.

Depends on: _none_

## Requirements

- FR-5: The guard must accept any combination of the closed role list defined in `domain/account/types.ts`; future roles must be usable without changing the guard itself.
- Techspec Component 1: `ACCOUNT_ROLES` must be `["seller", "payer", "risk_analyst", "risk_analyst_agent", "admin"] as const`.
- `PlatformRole` in `domain/receivable/transitions.ts` must remain unchanged.
- After the change, run `npm run lint` (or `tsc --noEmit`) to surface any exhaustive-switch errors introduced by the type expansion; fix them before marking done.

## Subtasks

- [ ] 1.1 Read `src/domain/account/types.ts` to understand the current `ACCOUNT_ROLES` definition
- [ ] 1.2 Read `src/domain/receivable/transitions.ts` to understand `PlatformRole` and confirm structural compatibility
- [ ] 1.3 Add `"payer"` and `"risk_analyst_agent"` to `ACCOUNT_ROLES` in `src/domain/account/types.ts`
- [ ] 1.4 Run `npm run lint` and fix any TypeScript errors caused by the expanded union (e.g. exhaustive switches)

## Implementation details

See **Techspec § Component 1 — Expand `AccountRole`**.

```typescript
// Before
export const ACCOUNT_ROLES = ["seller", "risk_analyst", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

// After
export const ACCOUNT_ROLES = [
  "seller",
  "payer",
  "risk_analyst",
  "risk_analyst_agent",
  "admin",
] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
```

The impact analysis in the techspec warns that exhaustive `switch (role)` statements over `AccountRole` elsewhere in the codebase may produce TypeScript errors. Find and fix all such locations before completing this task.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] `ACCOUNT_ROLES` contains exactly `["seller", "payer", "risk_analyst", "risk_analyst_agent", "admin"]`
- [ ] `AccountRole` type is derived from `ACCOUNT_ROLES` via `typeof ... [number]`
- [ ] `PlatformRole` in `domain/receivable/transitions.ts` is untouched
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-roles-guard/prd.md` ← read first
- `tasks/prd-roles-guard/techspec.md` ← read first
- `src/domain/account/types.ts` ← modify
- `src/domain/receivable/transitions.ts` ← read only (do not modify)
