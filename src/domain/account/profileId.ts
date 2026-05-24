import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../application/deps.js";
import { sellers } from "../../db/schema.runtime.js";
import { AUTH_ERROR_CODES, AuthError } from "./errors.js";
import type { AccountRole } from "./types.js";

/** TEMP: replace with real profile FK lookup when profile modules land. */
// @todo(module-2|3)
export function mockProfileId(accountId: string, role: AccountRole): string {
  return `placeholder-${role}-${accountId}`;
}

export async function resolveProfileId(
  deps: AppDeps,
  accountId: string,
  role: AccountRole,
): Promise<string> {
  if (role === "seller") {
    const [row] = await deps.db
      .select()
      .from(sellers)
      .where(and(eq(sellers.accountId, accountId), isNull(sellers.deletedAt)))
      .limit(1);
    if (!row) {
      throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    }
    return row.id;
  }
  return mockProfileId(accountId, role);
}
