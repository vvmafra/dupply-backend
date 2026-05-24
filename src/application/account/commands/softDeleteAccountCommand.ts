import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { accounts } from "../../../db/schema.runtime.js";
import { assertCanSoftDeleteAccount } from "../../../domain/account/policies.js";
import type { AccountRole } from "../../../domain/account/types.js";

export async function executeSoftDeleteAccount(
  deps: AppDeps,
  actor: { role: AccountRole },
  accountId: string,
): Promise<void> {
  assertCanSoftDeleteAccount(actor);

  const now = new Date();
  await deps.db
    .update(accounts)
    .set({
      deletedAt: now,
      updatedAt: now,
      refreshToken: null,
      refreshTokenLookup: null,
    })
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
}
