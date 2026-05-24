import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { sellers } from "../../../db/schema.runtime.js";

export async function executeSoftDeleteSeller(
  deps: AppDeps,
  sellerId: string,
): Promise<void> {
  const now = new Date();
  await deps.db
    .update(sellers)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(sellers.id, sellerId), isNull(sellers.deletedAt)));
}
