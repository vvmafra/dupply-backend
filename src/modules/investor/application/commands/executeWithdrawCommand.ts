import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { investors, investorWithdrawals } from "../../../../infra/database/schema.runtime.js";
import { runTransaction } from "../../../../infra/database/transaction.js";
import { toCents, toReais } from "../../../../shared/money.js";
import { InvestorError, INVESTOR_ERROR_CODES } from "../../domain/errors.js";

export type WithdrawInput = {
  accountId: string;
  amountReais: number;
  idempotencyKey: string;
  pixKey: string;
};

export type WithdrawResult = {
  id: string;
  investorId: string;
  amount: number;
  pixKey: string;
  status: string;
  createdAt: Date;
};

export async function executeWithdraw(
  deps: AppDeps,
  input: WithdrawInput,
): Promise<WithdrawResult> {
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

  // 3. Check for existing withdrawal with same idempotency key
  const [existing] = await deps.db
    .select()
    .from(investorWithdrawals)
    .where(
      and(
        eq(investorWithdrawals.investorId, investor.id),
        eq(investorWithdrawals.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "completed") {
      return {
        id: existing.id,
        investorId: existing.investorId,
        amount: toReais(existing.amountCents),
        pixKey: existing.pixKey,
        status: existing.status,
        createdAt: existing.createdAt,
      };
    }
    throw new InvestorError(INVESTOR_ERROR_CODES.WITHDRAW_IDEMPOTENCY_CONFLICT);
  }

  const withdrawalId = createId();
  const now = new Date();

  // 4. Process withdrawal inside transaction
  try {
    await runTransaction(deps.db, deps.config.DATABASE_URL, (tx, exec) => {
      exec(
        tx.insert(investorWithdrawals).values({
          id: withdrawalId,
          investorId: investor.id,
          amountCents,
          idempotencyKey: input.idempotencyKey,
          pixKey: input.pixKey,
          status: "completed",
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
    });
  } catch (error: any) {
    const errMessage = String(error?.message || "");
    const errCode = String(error?.code || "");
    if (
      errMessage.includes("UNIQUE") || 
      errMessage.includes("unique") || 
      errCode === "23505"
    ) {
      throw new InvestorError(INVESTOR_ERROR_CODES.WITHDRAW_IDEMPOTENCY_CONFLICT);
    }
    throw error;
  }

  return {
    id: withdrawalId,
    investorId: investor.id,
    amount: input.amountReais,
    pixKey: input.pixKey,
    status: "completed",
    createdAt: now,
  };
}
