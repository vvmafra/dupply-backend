import { and, eq, inArray } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import {
  investors,
  investorInvestments,
  receivables,
} from "../../../../infra/database/schema.runtime.js";
import { runTransaction } from "../../../../infra/database/transaction.js";
import { executePayoutWrites } from "../../../settlement/application/commands/executePayoutCommand.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../domain/transitions.js";
import { loadReceivableOrThrow } from "../receivableHelpers.js";

export type SystemPayerSettlementInput = {
  receivableId: string;
  outcome: "settled" | "overdue";
};

export async function executeSystemPayerSettlement(
  deps: AppDeps,
  input: SystemPayerSettlementInput,
): Promise<void> {
  const row = await loadReceivableOrThrow(deps, input.receivableId);
  const from = row.status as ReceivableStatus;

  let to: ReceivableStatus;
  if (from === RECEIVABLE_STATUS.COMPLETED) {
    to =
      input.outcome === "settled" ? RECEIVABLE_STATUS.PAYER_SETTLED : RECEIVABLE_STATUS.OVERDUE;
  } else if (from === RECEIVABLE_STATUS.OVERDUE && input.outcome === "settled") {
    to = RECEIVABLE_STATUS.PAYER_SETTLED;
  } else {
    throw new Error("invalid_payer_settlement_transition");
  }

  assertReceivableTransition(from, to, { kind: "system" });

  // 1. Fetch investments and investors if we are transitioning to settled
  let activeInvestments: any[] = [];
  let investorsList: any[] = [];

  if (to === RECEIVABLE_STATUS.PAYER_SETTLED) {
    activeInvestments = await deps.db
      .select()
      .from(investorInvestments)
      .where(
        and(
          eq(investorInvestments.receivableId, input.receivableId),
          eq(investorInvestments.status, "active"),
        ),
      );

    if (activeInvestments.length > 0) {
      const investorIds = [...new Set(activeInvestments.map((i) => i.investorId))];
      investorsList = await deps.db
        .select()
        .from(investors)
        .where(inArray(investors.id, investorIds));
    }
  }

  const now = new Date();

  // 2. Execute updates and payout inside transaction
  await runTransaction(deps.db, deps.config.DATABASE_URL, (tx, exec) => {
    if (to === RECEIVABLE_STATUS.PAYER_SETTLED && activeInvestments.length > 0) {
      executePayoutWrites(tx, exec, {
        receivableId: input.receivableId,
        yieldRateMonthly: Number(row.yieldRateMonthly || 0),
        activeInvestments,
        investorsList,
        paymentDate: now,
      });
    }

    exec(
      tx
        .update(receivables)
        .set({ status: to, updatedAt: now })
        .where(eq(receivables.id, input.receivableId)),
    );
  });
}
