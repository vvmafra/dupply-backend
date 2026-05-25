import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { receivables } from "../../../db/schema.runtime.js";
import { consumePayerMagicToken } from "../../payer/ports/magicLinkToken.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../../domain/receivable/transitions.js";
import { loadReceivableOrThrow } from "../receivableHelpers.js";

export type PayerMagicLinkRespondInput = {
  token: string;
  decision: "accept" | "reject";
};

export async function executePayerMagicLinkRespond(
  deps: AppDeps,
  input: PayerMagicLinkRespondInput,
): Promise<void> {
  const payload = await consumePayerMagicToken(deps, input.token);
  const row = await loadReceivableOrThrow(deps, payload.receivableId);

  if (row.payerId !== payload.payerId) {
    throw new Error("payer_mismatch");
  }

  const from = row.status as ReceivableStatus;
  const to =
    input.decision === "accept"
      ? RECEIVABLE_STATUS.CONFIRMED
      : RECEIVABLE_STATUS.PAYER_REJECTED;

  assertReceivableTransition(from, to, { kind: "payer_magic_link" });

  await deps.db
    .update(receivables)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(receivables.id, payload.receivableId));
}
