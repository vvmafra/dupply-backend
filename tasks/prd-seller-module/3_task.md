# Task 3.0: Register command + profileId resolution

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Implements `executeRegisterSeller` — the application command that atomically creates an `account` (role = seller) and a `seller` record in a single database transaction. Also replaces the `mockProfileId` stub for seller accounts so that JWT tokens issued via login and refresh carry the real `seller.id` as `profileId`. This task integrates with the existing auth infrastructure without breaking any current contracts.

Corresponds to **techspec component 4**.

Depends on: _1.0, 2.0_

## Requirements

- `executeRegisterSeller` creates `account` + `seller` atomically in one `db.transaction` (FR-1)
- Account is inserted with `role = "seller"` and `status = "active"`; seller is inserted with `status = "created"` and empty JSON metadata blobs (FR-1)
- Duplicate email → rely on DB unique constraint, map to `409 email_already_exists` (FR-2)
- `resolveProfileId` in `src/domain/account/profileId.ts` queries the `sellers` table for `role = "seller"` accounts and returns the real `seller.id`; falls back to `mockProfileId` for other roles (FR-2)
- `loginCommands.ts` and `refreshCommands.ts` updated to call `resolveProfileId` instead of `mockProfileId` directly
- Register returns `{ accountId, sellerId }` (HTTP layer in task 7 will add tokens)
- Integration tests: atomic rollback on duplicate email, JWT `profileId` equals `sellerId`

## Subtasks

- [ ] 3.1 Read `src/application/account/commands/accountAuthDb.ts` (or equivalent) and `loginCommands.ts` / `refreshCommands.ts` to understand the existing DB transaction and JWT patterns
- [ ] 3.2 Read `src/domain/account/profileId.ts` to understand the current `mockProfileId` implementation
- [ ] 3.3 Create `src/application/seller/commands/registerSellerCommand.ts` implementing `executeRegisterSeller` with the atomic transaction
- [ ] 3.4 Modify `src/domain/account/profileId.ts` — implement `resolveProfileId(deps, accountId, role)` that queries sellers for `role = "seller"` and returns `seller.id`
- [ ] 3.5 Update `loginCommands.ts` to call `resolveProfileId` instead of `mockProfileId`
- [ ] 3.6 Update `refreshCommands.ts` to call `resolveProfileId` instead of `mockProfileId`
- [ ] 3.7 Write integration tests `tests/application/seller/registerSellerCommand.test.ts`: atomic tx succeeds, duplicate email rolls back, returned `sellerId` matches DB, update `tests/routes/v1/accountAuthRoutes.test.ts` for register scenarios
- [ ] 3.8 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "4. Application — register (account + seller transaction)"**.

```typescript
// src/application/seller/commands/registerSellerCommand.ts
export async function executeRegisterSeller(
  deps: AppDeps,
  input: { email: string; password: string; name: string },
): Promise<{ accountId: string; sellerId: string }> {
  const accountId = createId();
  const sellerId = createId();
  const passwordHash = await argon2.hash(input.password);

  await deps.db.transaction(async (tx) => {
    await tx.insert(accounts).values({ id: accountId, email: input.email, passwordHash, role: "seller", status: "active" });
    await tx.insert(sellers).values({
      id: sellerId,
      name: input.name,
      status: "created",
      accountId,
      companyMetaData: JSON.stringify({}),
      legalRepresentativeMetaData: JSON.stringify({}),
      businessRelationsMetaData: JSON.stringify({ clients: [], suppliers: [] }),
      walletId: null,
    });
  });

  return { accountId, sellerId };
}
```

`resolveProfileId` pattern:

```typescript
// src/domain/account/profileId.ts
export async function resolveProfileId(deps: AppDeps, accountId: string, role: AccountRole): Promise<string> {
  if (role === "seller") {
    const [row] = await deps.db.select({ id: sellers.id }).from(sellers)
      .where(and(eq(sellers.accountId, accountId), isNull(sellers.deletedAt)))
      .limit(1);
    if (!row) throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    return row.id;
  }
  return mockProfileId(accountId, role); // risk_analyst / admin until their modules land
}
```

**Only `role = "seller"` is supported for self-registration in v1.** Other roles in the register body → return `400 unsupported_role`.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Registering a seller creates exactly one `account` row and one `seller` row in the same transaction
- [ ] Duplicate email attempt results in rollback — neither account nor seller is persisted
- [ ] `resolveProfileId` returns `seller.id` for a seller account
- [ ] JWT `profileId` after login equals the `seller.id` from the DB
- [ ] Existing login and refresh tests still pass
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-seller-module/prd.md` ← read first
- `tasks/prd-seller-module/techspec.md` ← read first
- `src/application/seller/commands/registerSellerCommand.ts` ← create
- `src/domain/account/profileId.ts` ← modify
- `src/application/account/commands/loginCommands.ts` ← modify
- `src/application/account/commands/refreshCommands.ts` ← modify
- `tests/application/seller/registerSellerCommand.test.ts` ← create
- `tests/routes/v1/accountAuthRoutes.test.ts` ← modify
