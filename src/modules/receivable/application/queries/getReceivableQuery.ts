import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { receivables } from "../../../../infra/database/schema.runtime.js";
import type { AccountRole } from "../../../account/domain/types.js";
import { assertCanViewReceivable } from "../../domain/policies.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../domain/errors.js";
import type { ReceivableRow } from "../../domain/types.js";
import { mapReceivableRow } from "../receivableHelpers.js";

export type GetReceivableInput = {
  receivableId: string;
  actor: { profileId: string; role: AccountRole };
};

export async function executeGetReceivable(
  deps: AppDeps,
  input: GetReceivableInput,
): Promise<ReceivableRow> {
  const [row] = await deps.db
    .select()
    .from(receivables)
    .where(and(eq(receivables.id, input.receivableId), isNull(receivables.deletedAt)))
    .limit(1);

  if (!row) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.NOT_FOUND);
  }

  if (!assertCanViewReceivable(input.actor, row)) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.FORBIDDEN);
  }

  return mapReceivableRow(row);
}
