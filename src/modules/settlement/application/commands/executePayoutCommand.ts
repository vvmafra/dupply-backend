import { eq } from "drizzle-orm";
import type { Db } from "../../../../infra/database/index.js";
import { investors, investorInvestments } from "../../../../infra/database/schema.runtime.js";
import type { TxExec } from "../../../../infra/database/transaction.js";

export type PayoutWriteInput = {
  receivableId: string;
  yieldRateAnnual: number;
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
 * Enqueues database updates inside a transaction to payout investors
 * with pro-rata yield calculated over a 365-day convention.
 */
export function executePayoutWrites(
  tx: Db,
  exec: TxExec,
  input: PayoutWriteInput,
): void {
  const { activeInvestments, investorsList, yieldRateAnnual, paymentDate } = input;

  if (activeInvestments.length === 0) {
    return;
  }

  // 1. Determine T_funded as the maximum createdAt of active investments
  const fundedDate = new Date(Math.max(...activeInvestments.map((i) => i.createdAt.getTime())));

  // 2. Calculate days (T_payment - T_funded, minimum 1 day)
  const diffTime = paymentDate.getTime() - fundedDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const days = Math.max(1, diffDays);

  // Keep track of accumulated balance updates per investor
  const balanceUpdates = new Map<string, number>();

  for (const inv of activeInvestments) {
    // Interest = Principal * (YieldRateAnnual / 365) * Days
    const interest = inv.amountCents * (yieldRateAnnual / 365) * days;
    const interestCents = Math.round(interest);
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

  // 3. Apply balance updates to each investor
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
