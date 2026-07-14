import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { accounts } from "../../../../infra/database/schema.runtime.js";
import { refreshTokenLookupKey } from "../../../../infra/auth/refreshToken.js";

export async function executeLogout(deps: AppDeps, plainRefreshToken: string): Promise<void> {
  const lookup = refreshTokenLookupKey(plainRefreshToken);
  const [row] = await deps.db
    .select()
    .from(accounts)
    .where(eq(accounts.refreshTokenLookup, lookup))
    .limit(1);

  if (!row) return;

  await deps.db
    .update(accounts)
    .set({
      refreshToken: null,
      refreshTokenLookup: null,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, row.id));
}
