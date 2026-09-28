import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { investors, investorInvestments, receivables } from "../../../../infra/database/schema.runtime.js";
import { runTransaction } from "../../../../infra/database/transaction.js";
import { toCents, toReais } from "../../../../shared/money.js";
import { InvestorError, INVESTOR_ERROR_CODES } from "../../domain/errors.js";

export type InvestInput = {
  accountId: string;
  receivableId: string;
  amountReais: number;
  idempotencyKey: string;
};

export type InvestResult = {
  id: string;
  investorId: string;
  receivableId: string;
  amount: number;
  status: string;
  createdAt: Date;
};

export async function executeInvest(
  deps: AppDeps,
  input: InvestInput,
): Promise<InvestResult> {
  if (input.amountReais <= 0) {
    throw new InvestorError(INVESTOR_ERROR_CODES.INVALID_AMOUNT);
  }

  const amountCents = toCents(input.amountReais);

  // 1. Load investor by account ID
  const [investor] = await deps.db
    .select()
    .from(investors)
    .where(eq(investors.accountId, input.accountId))
    .limit(1);

  if (!investor) {
    throw new InvestorError(INVESTOR_ERROR_CODES.NOT_FOUND);
  }

  // 2. Check balance
  if (investor.balanceCents < amountCents) {
    throw new InvestorError(INVESTOR_ERROR_CODES.INSUFFICIENT_FUNDS);
  }

  // 3. Load receivable
  const [receivable] = await deps.db
    .select()
    .from(receivables)
    .where(eq(receivables.id, input.receivableId))
    .limit(1);

  if (!receivable) {
    throw new InvestorError(INVESTOR_ERROR_CODES.RECEIVABLE_NOT_FOUND);
  }

  // 4. Validate receivable status is 'funding'
  if (receivable.status !== "funding") {
    throw new InvestorError(INVESTOR_ERROR_CODES.RECEIVABLE_NOT_OPEN_FOR_FUNDING);
  }

  // 5. Check if investment exceeds remaining funding
  const remainingCents = receivable.targetFundingCents - receivable.fundedCents;
  if (amountCents > remainingCents) {
    throw new InvestorError(INVESTOR_ERROR_CODES.INVESTMENT_EXCEEDS_REMAINING_FUNDING);
  }

  // 5b. Enforce the minimum ticket, except when closing a remainder smaller than it
  if (
    receivable.minInvestmentCents > 0 &&
    amountCents < receivable.minInvestmentCents &&
    amountCents !== remainingCents
  ) {
    throw new InvestorError(INVESTOR_ERROR_CODES.INVESTMENT_BELOW_MINIMUM);
  }

  // 6. Check for existing investment with same idempotency key
  const [existing] = await deps.db
    .select()
    .from(investorInvestments)
    .where(
      and(
        eq(investorInvestments.investorId, investor.id),
        eq(investorInvestments.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "active") {
      return {
        id: existing.id,
        investorId: existing.investorId,
        receivableId: existing.receivableId,
        amount: toReais(existing.amountCents),
        status: existing.status,
        createdAt: existing.createdAt,
      };
    }
    throw new InvestorError(INVESTOR_ERROR_CODES.INVEST_IDEMPOTENCY_CONFLICT);
  }

  const investmentId = createId();
  const now = new Date();

  const newFundedCents = receivable.fundedCents + amountCents;
  const isFullyFunded = newFundedCents === receivable.targetFundingCents;

  // 7. Process investment inside transaction
  try {
    await runTransaction(deps.db, deps.config.DATABASE_URL, (tx, exec) => {
      exec(
        tx.insert(investorInvestments).values({
          id: investmentId,
          investorId: investor.id,
          receivableId: receivable.id,
          amountCents,
          idempotencyKey: input.idempotencyKey,
          status: "active",
          createdAt: now,
          updatedAt: now,
        }),
      );
      exec(
        tx
          .update(investors)
          .set({
            balanceCents: investor.balanceCents - amountCents,
            updatedAt: now,
          })
          .where(eq(investors.id, investor.id)),
      );
      
      const receivableUpdate: any = {
        fundedCents: newFundedCents,
        updatedAt: now,
      };
      if (isFullyFunded) {
        receivableUpdate.status = "funded";
      }

      exec(
        tx
          .update(receivables)
          .set(receivableUpdate)
          .where(eq(receivables.id, receivable.id)),
      );
    });
  } catch (error: any) {
    const errMessage = String(error?.message || "");
    const errCode = String(error?.code || "");
    if (
      errMessage.includes("UNIQUE") || 
      errMessage.includes("unique") || 
      errCode === "23505"
    ) {
      throw new InvestorError(INVESTOR_ERROR_CODES.INVEST_IDEMPOTENCY_CONFLICT);
    }
    throw error;
  }

  return {
    id: investmentId,
    investorId: investor.id,
    receivableId: receivable.id,
    amount: input.amountReais,
    status: "active",
    createdAt: now,
  };
}
