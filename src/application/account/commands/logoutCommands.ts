import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { accounts } from "../../../db/schema.runtime.js";
import { refreshTokenLookupKey } from "../../../lib/refreshToken.js";

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
