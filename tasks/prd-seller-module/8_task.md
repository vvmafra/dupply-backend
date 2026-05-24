# Task 8.0: Receivable guard integration

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Updates the existing receivable creation command to enforce the `seller.status = active` guard. Currently the command validates account-level data; this task replaces that with a proper join against the `sellers` table and calls `assertSellerCanCreateReceivable` from the domain layer. Also maps the new `seller_not_active` error code to HTTP `403` in the receivables route error handler.

Corresponds to **techspec component 9**.

Depends on: _1.0, 2.0, 7.0_

## Requirements

- `executeCreateReceivable` joins `sellers` on `accounts.id = sellers.account_id` and applies `WHERE accounts.deleted_at IS NULL AND sellers.deleted_at IS NULL` (FR-14, FR-15)
- Calls `assertSellerCanCreateReceivable(seller)` — throws `seller_not_active` if `status !== "active"` or `deletedAt !== null` (FR-14)
- `src/routes/v1/receivables.ts` error mapper handles `seller_not_active` → `403` (FR-14)
- Sellers with status `created`, `in_review`, `inactive`, or soft-deleted cannot create receivables

## Subtasks

- [ ] 8.1 Read `src/application/receivable/commands/receivableCommands.ts` to understand the current seller validation pattern
- [ ] 8.2 Read `src/routes/v1/receivables.ts` to understand the current error mapper
- [ ] 8.3 Replace the account-only seller check in `executeCreateReceivable` with the join query and `assertSellerCanCreateReceivable` call
- [ ] 8.4 Update the receivables route error mapper to handle `seller_not_active` → `403`
- [ ] 8.5 Write tests `tests/application/receivable/receivableCommands.test.ts` for: `status = active` → creates receivable; `status = created/in_review/inactive` → 403; soft-deleted seller → 403
- [ ] 8.6 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "9. Receivable guard integration"**.

```typescript
// executeCreateReceivable — after
const [row] = await deps.db
  .select()
  .from(sellers)
  .innerJoin(accounts, eq(sellers.accountId, accounts.id))
  .where(
    and(
      eq(accounts.id, input.sellerUserId),
      eq(accounts.role, "seller"),
      isNull(accounts.deletedAt),
      isNull(sellers.deletedAt),
    ),
  )
  .limit(1);

if (!row) throw new Error("invalid_seller");
assertSellerCanCreateReceivable(row.sellers); // throws seller_not_active if status !== "active"
```

Add to receivables error mapper:

```typescript
if (error instanceof SellerError && error.code === SELLER_ERROR_CODES.NOT_ACTIVE) {
  return reply.status(403).send({ error: "seller_not_active" });
}
```

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] Unit tests pass (`npm test`)
- [ ] Seller with `status = active` can create a receivable (`201`)
- [ ] Seller with `status = created` cannot create a receivable (`403 seller_not_active`)
- [ ] Seller with `status = in_review` cannot create a receivable (`403 seller_not_active`)
- [ ] Seller with `status = inactive` cannot create a receivable (`403 seller_not_active`)
- [ ] Soft-deleted seller cannot create a receivable (`403`)
- [ ] Existing receivable tests that relied on `status = active` sellers continue to pass
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-seller-module/prd.md` ← read first
- `tasks/prd-seller-module/techspec.md` ← read first
- `src/application/receivable/commands/receivableCommands.ts` ← modify
- `src/routes/v1/receivables.ts` ← modify
- `tests/application/receivable/receivableCommands.test.ts` ← modify
