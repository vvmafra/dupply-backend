import { desc, eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { investors, investorWithdrawals } from "../../../../infra/database/schema.runtime.js";
import { toReais } from "../../../../shared/money.js";
import { InvestorError, INVESTOR_ERROR_CODES } from "../../domain/errors.js";

export type WithdrawalItem = {
  id: string;
  amount: number;
  idempotencyKey: string;
  pixKey: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function executeListWithdrawals(
  deps: AppDeps,
  accountId: string,
): Promise<WithdrawalItem[]> {
  const [investor] = await deps.db
    .select()
    .from(investors)
    .where(eq(investors.accountId, accountId))
    .limit(1);

  if (!investor) {
    throw new InvestorError(INVESTOR_ERROR_CODES.NOT_FOUND);
  }

  const rows = await deps.db
    .select()
    .from(investorWithdrawals)
    .where(eq(investorWithdrawals.investorId, investor.id))
    .orderBy(desc(investorWithdrawals.createdAt));

  return rows.map((row) => ({
    id: row.id,
    amount: toReais(row.amountCents),
    idempotencyKey: row.idempotencyKey,
    pixKey: row.pixKey,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}
