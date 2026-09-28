import { desc, eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { investors, investorInvestments, receivables } from "../../../../infra/database/schema.runtime.js";
import { toReais } from "../../../../shared/money.js";
import { InvestorError, INVESTOR_ERROR_CODES } from "../../domain/errors.js";

export type InvestmentItem = {
  id: string;
  receivableId: string;
  amount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  receivable: {
    status: string;
    targetFunding: number;
    funded: number;
    /** Simple monthly rate as a fraction (0.018 = 1.8% a.m.). */
    yieldRateMonthly: number;
  };
};

export async function executeListInvestments(
  deps: AppDeps,
  accountId: string,
): Promise<InvestmentItem[]> {
  const [investor] = await deps.db
    .select()
    .from(investors)
    .where(eq(investors.accountId, accountId))
    .limit(1);

  if (!investor) {
    throw new InvestorError(INVESTOR_ERROR_CODES.NOT_FOUND);
  }

  const rows = await deps.db
    .select({
      id: investorInvestments.id as any,
      receivableId: investorInvestments.receivableId as any,
      amountCents: investorInvestments.amountCents as any,
      status: investorInvestments.status as any,
      createdAt: investorInvestments.createdAt as any,
      updatedAt: investorInvestments.updatedAt as any,
      receivableStatus: receivables.status as any,
      receivableTargetFundingCents: receivables.targetFundingCents as any,
      receivableFundedCents: receivables.fundedCents as any,
      receivableYieldRateMonthly: receivables.yieldRateMonthly as any,
    })
    .from(investorInvestments)
    .innerJoin(receivables, eq(investorInvestments.receivableId, receivables.id))
    .where(eq(investorInvestments.investorId, investor.id))
    .orderBy(desc(investorInvestments.createdAt));

  return rows.map((row) => ({
    id: row.id,
    receivableId: row.receivableId,
    amount: toReais(row.amountCents),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    receivable: {
      status: row.receivableStatus,
      targetFunding: toReais(row.receivableTargetFundingCents),
      funded: toReais(row.receivableFundedCents),
      yieldRateMonthly: row.receivableYieldRateMonthly,
    },
  }));
}
