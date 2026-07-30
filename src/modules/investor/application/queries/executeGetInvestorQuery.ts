import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { accounts, investors } from "../../../../infra/database/schema.runtime.js";
import { toReais } from "../../../../shared/money.js";
import { InvestorError, INVESTOR_ERROR_CODES } from "../../domain/errors.js";

export type GetInvestorResult = {
  id: string;
  name: string;
  email: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function executeGetInvestor(
  deps: AppDeps,
  accountId: string,
): Promise<GetInvestorResult> {
  const [investor] = await deps.db
    .select()
    .from(investors)
    .where(eq(investors.accountId, accountId))
    .limit(1);

  if (!investor) {
    throw new InvestorError(INVESTOR_ERROR_CODES.NOT_FOUND);
  }

  const [account] = await deps.db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new InvestorError(INVESTOR_ERROR_CODES.NOT_FOUND);
  }

  return {
    id: investor.id,
    name: investor.name,
    email: account.email,
    balance: toReais(investor.balanceCents),
    createdAt: investor.createdAt,
    updatedAt: investor.updatedAt,
  };
}
