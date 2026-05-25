import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { receivables } from "../../../db/schema.runtime.js";
import type { AccountRole } from "../../../domain/account/types.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../domain/receivable/errors.js";
import type { ReceivableRow } from "../../../domain/receivable/types.js";
import { mapReceivableRow } from "../receivableHelpers.js";

export async function executeListReceivables(
  deps: AppDeps,
  actor: { profileId: string; role: AccountRole },
  limit = 200,
): Promise<ReceivableRow[]> {
  const { db } = deps;

  if (actor.role === "seller") {
    const rows = await db
      .select()
      .from(receivables)
      .where(and(eq(receivables.sellerId, actor.profileId), isNull(receivables.deletedAt)))
      .limit(limit);
    return rows.map(mapReceivableRow);
  }

  if (
    actor.role === "admin" ||
    actor.role === "risk_analyst" ||
    actor.role === "risk_analyst_agent"
  ) {
    const rows = await db
      .select()
      .from(receivables)
      .where(isNull(receivables.deletedAt))
      .limit(limit);
    return rows.map(mapReceivableRow);
  }

  throw new ReceivableError(RECEIVABLE_ERROR_CODES.FORBIDDEN);
}
