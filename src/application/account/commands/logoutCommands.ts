import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { accounts } from "../../../db/schema.runtime.js";

export async function executeLogout(deps: AppDeps, accountId: string): Promise<void> {
  await deps.db
    .update(accounts)
    .set({
      refreshToken: null,
      refreshTokenLookup: null,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));
}
