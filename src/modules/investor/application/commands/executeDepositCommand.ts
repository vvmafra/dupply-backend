import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import { investors, investorDeposits } from "../../../../infra/database/schema.runtime.js";
import { runTransaction } from "../../../../infra/database/transaction.js";
import { toCents, toReais } from "../../../../shared/money.js";
import { InvestorError, INVESTOR_ERROR_CODES } from "../../domain/errors.js";

export type DepositInput = {
  accountId: string;
  amountReais: number;
  idempotencyKey: string;
  externalTxId?: string;
};

export type DepositResult = {
  id: string;
  investorId: string;
  amount: number;
  status: string;
  externalTxId: string | null;
  createdAt: Date;
};

export async function executeDeposit(
  deps: AppDeps,
  input: DepositInput,
): Promise<DepositResult> {
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

  // 2. Check if a deposit with the same idempotency key already exists
  const [existing] = await deps.db
    .select()
    .from(investorDeposits)
    .where(
      and(
        eq(investorDeposits.investorId, investor.id),
        eq(investorDeposits.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "completed") {
      return {
        id: existing.id,
        investorId: existing.investorId,
        amount: toReais(existing.amountCents),
        status: existing.status,
        externalTxId: existing.externalTxId,
        createdAt: existing.createdAt,
      };
    }
    throw new InvestorError(INVESTOR_ERROR_CODES.IDEMPOTENCY_CONFLICT);
  }

  const depositId = createId();
  const now = new Date();

  // 3. Process deposit and update balance in database transaction
  try {
    await runTransaction(deps.db, deps.config.DATABASE_URL, (tx, exec) => {
      exec(
        tx.insert(investorDeposits).values({
          id: depositId,
          investorId: investor.id,
          amountCents,
          idempotencyKey: input.idempotencyKey,
          externalTxId: input.externalTxId ?? null,
          status: "completed",
          createdAt: now,
          updatedAt: now,
        }),
      );
      exec(
        tx
          .update(investors)
          .set({
            balanceCents: investor.balanceCents + amountCents,
            updatedAt: now,
          })
          .where(eq(investors.id, investor.id)),
      );
    });
  } catch (error: any) {
    // Check for unique constraint violation (idempotency key)
    const errMessage = String(error?.message || "");
    const errCode = String(error?.code || "");
    if (
      errMessage.includes("UNIQUE") || 
      errMessage.includes("unique") || 
      errCode === "23505"
    ) {
      throw new InvestorError(INVESTOR_ERROR_CODES.IDEMPOTENCY_CONFLICT);
    }
    throw error;
  }

  return {
    id: depositId,
    investorId: investor.id,
    amount: input.amountReais,
    status: "completed",
    externalTxId: input.externalTxId ?? null,
    createdAt: now,
  };
}
