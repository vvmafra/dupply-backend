import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { accounts } from "../../../db/schema.runtime.js";
import { ACCOUNT_ERROR_CODES, AccountError } from "../../../domain/account/errors.js";
import { assertCanReadAccount } from "../../../domain/account/policies.js";
import type { AccountPublicView, AccountRole, AccountStatus } from "../../../domain/account/types.js";

function toPublicView(row: typeof accounts.$inferSelect): AccountPublicView {
  return {
    id: row.id,
    email: row.email,
    role: row.role as AccountRole,
    status: row.status as AccountStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function executeGetAccount(
  deps: AppDeps,
  actor: { sub: string; role: AccountRole },
  accountId: string,
): Promise<AccountPublicView> {
  assertCanReadAccount(actor, accountId);

  const [row] = await deps.db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
    .limit(1);

  if (!row) {
    throw new AccountError(ACCOUNT_ERROR_CODES.NOT_FOUND);
  }

  return toPublicView(row);
}
