import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { receivables } from "../../../../infra/database/schema.runtime.js";
import { toCents } from "../../../../shared/money.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../domain/errors.js";
import { resolveOfferTerms } from "../../domain/offerTerms.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../domain/transitions.js";
import { loadReceivableOrThrow, valueReaisToDbCentsText, appendStatusHistory } from "../receivableHelpers.js";

export type RiskDecisionInput = {
  receivableId: string;
  actorRole: string;
  decision: "offer" | "reprove";
  /** Reais. Required for `offer`. */
  proposedValue?: number;
  /** Fraction, e.g. 0.018 = 1.8% a.m. Only with `offer`. */
  yieldRateMonthly?: number;
  /** Reais. Minimum ticket per investment. Only with `offer`. */
  minInvestment?: number;
};

export async function executeRiskDecision(deps: AppDeps, input: RiskDecisionInput): Promise<void> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  const from = row.status as ReceivableStatus;

  const to =
    input.decision === "offer" ? RECEIVABLE_STATUS.OFFER : RECEIVABLE_STATUS.REPROVED;

  const hasTerms = input.yieldRateMonthly !== undefined || input.minInvestment !== undefined;

  if (to === RECEIVABLE_STATUS.OFFER) {
    if (input.proposedValue === undefined || input.proposedValue <= 0) {
      throw new ReceivableError(RECEIVABLE_ERROR_CODES.PROPOSED_VALUE_REQUIRED);
    }
  } else {
    if (input.proposedValue !== undefined) {
      throw new ReceivableError(RECEIVABLE_ERROR_CODES.PROPOSED_VALUE_FORBIDDEN);
    }
    if (hasTerms) {
      throw new ReceivableError(RECEIVABLE_ERROR_CODES.OFFER_TERMS_FORBIDDEN);
    }
  }

  assertReceivableTransition(from, to, { kind: "user", role: input.actorRole });

  if (to === RECEIVABLE_STATUS.OFFER) {
    const proposedCents = toCents(input.proposedValue!);
    const terms = resolveOfferTerms({
      yieldRateMonthly: input.yieldRateMonthly,
      minInvestmentCents:
        input.minInvestment === undefined ? undefined : toCents(input.minInvestment),
      targetCents: proposedCents,
    });

    await deps.db
      .update(receivables)
      .set({
        status: to,
        proposedValue: valueReaisToDbCentsText(input.proposedValue),
        yieldRateMonthly: terms.yieldRateMonthly,
        minInvestmentCents: terms.minInvestmentCents,
        statusHistory: appendStatusHistory(row.statusHistory, to),
        updatedAt: new Date(),
      })
      .where(eq(receivables.id, input.receivableId));
    return;
  }

  await deps.db
    .update(receivables)
    .set({
      status: to,
      proposedValue: null,
      statusHistory: appendStatusHistory(row.statusHistory, to),
      updatedAt: new Date(),
    })
    .where(eq(receivables.id, input.receivableId));
}
