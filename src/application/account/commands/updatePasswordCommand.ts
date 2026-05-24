import argon2 from "argon2";
import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { accounts } from "../../../db/schema.runtime.js";
import { assertCanMutateAccount } from "../../../domain/account/policies.js";
import type { AccountRole } from "../../../domain/account/types.js";

export type UpdatePasswordInput = {
  password: string;
};

/**
 * Password update does not invalidate the current refresh token in v1.
 * @todo(hardening) Clear refresh token on password change for forced re-login.
 */
export async function executeUpdatePassword(
  deps: AppDeps,
  actor: { sub: string; role: AccountRole },
  accountId: string,
  input: UpdatePasswordInput,
): Promise<void> {
  assertCanMutateAccount(actor, accountId);

  const passwordHash = await argon2.hash(input.password);
  await deps.db
    .update(accounts)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
}
