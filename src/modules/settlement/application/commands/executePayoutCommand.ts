import { eq } from "drizzle-orm";
import type { Db } from "../../../../infra/database/index.js";
import { investors, investorInvestments } from "../../../../infra/database/schema.runtime.js";
import type { TxExec } from "../../../../infra/database/transaction.js";
import { accrualDays, computeSimpleInterestCents } from "../../domain/yield.js";

export type PayoutWriteInput = {
  receivableId: string;
  /** Simple monthly rate as a fraction (0.018 = 1.8% a.m.). */
  yieldRateMonthly: number;
  activeInvestments: Array<{
    id: string;
    investorId: string;
    amountCents: number;
    createdAt: Date;
  }>;
  investorsList: Array<{
    id: string;
    balanceCents: number;
  }>;
  paymentDate: Date;
};

/**
 * Enqueues database updates inside a transaction to pay investors back their principal plus
 * simple interest, pro-rata by days over a 30-day month (see `domain/yield.ts`).
 */
export function executePayoutWrites(
  tx: Db,
  exec: TxExec,
  input: PayoutWriteInput,
): void {
  const { activeInvestments, investorsList, yieldRateMonthly, paymentDate } = input;

  if (activeInvestments.length === 0) {
    return;
  }

  // 1. T_funded = the moment the last active investment closed the target
  const fundedDate = new Date(Math.max(...activeInvestments.map((i) => i.createdAt.getTime())));
  const days = accrualDays(fundedDate, paymentDate);

  // Keep track of accumulated balance updates per investor
  const balanceUpdates = new Map<string, number>();

  for (const inv of activeInvestments) {
    const interestCents = computeSimpleInterestCents(inv.amountCents, yieldRateMonthly, days);
    const payoutCents = inv.amountCents + interestCents;

    const currentAccumulated = balanceUpdates.get(inv.investorId) || 0;
    balanceUpdates.set(inv.investorId, currentAccumulated + payoutCents);

    // Update investment status to 'settled'
    exec(
      tx
        .update(investorInvestments)
        .set({
          status: "settled",
          updatedAt: paymentDate,
        })
        .where(eq(investorInvestments.id, inv.id)),
    );
  }

  // 2. Apply balance updates to each investor
  for (const [investorId, additionalCents] of balanceUpdates.entries()) {
    const investor = investorsList.find((i) => i.id === investorId);
    if (!investor) {
      continue;
    }

    exec(
      tx
        .update(investors)
        .set({
          balanceCents: investor.balanceCents + additionalCents,
          updatedAt: paymentDate,
        })
        .where(eq(investors.id, investorId)),
    );
  }
}
