import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { accounts } from "../../../../infra/database/schema.runtime.js";
import { assertCanSoftDeleteAccount } from "../../domain/policies.js";
import type { AccountRole } from "../../domain/types.js";

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
