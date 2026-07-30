import { desc, eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { investors, investorDeposits } from "../../../../infra/database/schema.runtime.js";
import { toReais } from "../../../../shared/money.js";
import { InvestorError, INVESTOR_ERROR_CODES } from "../../domain/errors.js";

export type DepositItem = {
  id: string;
  amount: number;
  idempotencyKey: string;
  externalTxId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function executeListDeposits(
  deps: AppDeps,
  accountId: string,
): Promise<DepositItem[]> {
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
    .from(investorDeposits)
    .where(eq(investorDeposits.investorId, investor.id))
    .orderBy(desc(investorDeposits.createdAt));

  return rows.map((row) => ({
    id: row.id,
    amount: toReais(row.amountCents),
    idempotencyKey: row.idempotencyKey,
    externalTxId: row.externalTxId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}
