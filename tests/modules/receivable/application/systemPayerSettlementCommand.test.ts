import assert from "node:assert/strict";
import test from "node:test";

import { and, eq } from "drizzle-orm";

import { executeSystemAdvanceSettlement } from "../../../../src/modules/receivable/application/commands/systemAdvanceSettlementCommand.js";
import { executeSystemPayerSettlement } from "../../../../src/modules/receivable/application/commands/systemPayerSettlementCommand.js";
import { executeRiskDecision } from "../../../../src/modules/receivable/application/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../../../src/modules/receivable/application/commands/sellerDecisionCommand.js";
import { executeSubmitReceivable } from "../../../../src/modules/receivable/application/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../../../src/modules/receivable/application/commands/updateReceivableDraftCommand.js";
import { executeInvest } from "../../../../src/modules/investor/application/commands/executeInvestCommand.js";
import { insertInvestor } from "../../../helpers/investorTestHelpers.js";
import {
  investors,
  investorInvestments,
  receivables,
} from "../../../../src/infra/database/schema.runtime.js";
import { RECEIVABLE_STATUS } from "../../../../src/modules/receivable/domain/transitions.js";
import {
  completeReceivableMetaData,
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../../helpers/receivableTestHelpers.js";

async function completedReceivable(
  deps: Awaited<ReturnType<typeof createTestContext>>["deps"],
  sellerId: string,
) {
  const id = await createDraftReceivable(deps, sellerId);
  await executeUpdateReceivableDraft(deps, {
    receivableId: id,
    profileId: sellerId,
    receivableMetaData: completeReceivableMetaData,
  });
  await executeSubmitReceivable(deps, {
    receivableId: id,
    profileId: sellerId,
    actorRole: "seller",
  });
  await executeRiskDecision(deps, {
    receivableId: id,
    actorRole: "risk_analyst",
    decision: "offer",
    proposedValue: 450,
  });
  await executeSellerDecision(deps, {
    receivableId: id,
    profileId: sellerId,
    actorRole: "seller",
    decision: "accept",
  });
  await executeSystemAdvanceSettlement(deps, {
    receivableId: id,
    targetStatus: RECEIVABLE_STATUS.PROCESSING,
  });
  await executeSystemAdvanceSettlement(deps, {
    receivableId: id,
    targetStatus: RECEIVABLE_STATUS.COMPLETED,
  });
  return id;
}

test("completed + overdue → overdue, then overdue + settled → payer_settled", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await completedReceivable(deps, sellerId);
    await executeSystemPayerSettlement(deps, { receivableId: id, outcome: "overdue" });
    let [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.OVERDUE);
    await executeSystemPayerSettlement(deps, { receivableId: id, outcome: "settled" });
    [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.PAYER_SETTLED);
  } finally {
    await handle.close();
  }
});

test("payer settlement payout - simple monthly interest pro-rata 30 days, credits investor balances, marks active investments settled", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);

    // 1. Create a receivable with target captação and yield rate
    // Proposed value: R$ 500,00 (value = 500)
    const receivableId = await createDraftReceivable(deps, sellerId, { value: 500 });
    
    // Set status to funding, targetFundingCents to 40000 (R$ 400,00), and yieldRateMonthly to 1% a.m.
    await deps.db
      .update(receivables)
      .set({
        status: RECEIVABLE_STATUS.FUNDING,
        targetFundingCents: 40000,
        yieldRateMonthly: 0.01,
        updatedAt: new Date(),
      })
      .where(eq(receivables.id, receivableId));

    // 2. Set up two investors
    const invA = await insertInvestor(deps, { name: "Investor A" });
    const invB = await insertInvestor(deps, { name: "Investor B" });

    // Give them free balance (R$ 500,00 and R$ 300,00)
    await deps.db
      .update(investors)
      .set({ balanceCents: 50000 })
      .where(eq(investors.id, invA.investorId));
    await deps.db
      .update(investors)
      .set({ balanceCents: 30000 })
      .where(eq(investors.id, invB.investorId));

    // 3. Make investments (Investor A: R$ 250,00; Investor B: R$ 150,00 -> Total R$ 400,00, Meta reached!)
    await executeInvest(deps, {
      accountId: invA.accountId,
      receivableId,
      amountReais: 250.0,
      idempotencyKey: "key-a",
    });

    await executeInvest(deps, {
      accountId: invB.accountId,
      receivableId,
      amountReais: 150.0,
      idempotencyKey: "key-b",
    });

    // Receivable should automatically be 'funded' now
    let [recRow] = await deps.db.select().from(receivables).where(eq(receivables.id, receivableId));
    assert.equal(recRow.status, "funded");

    // 4. Manually shift investment createdAt timestamps in the database to 15 days ago
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    await deps.db
      .update(investorInvestments)
      .set({ createdAt: fifteenDaysAgo })
      .where(eq(investorInvestments.receivableId, receivableId));

    // 5. Advance receivable through processing to completed
    await executeSystemAdvanceSettlement(deps, {
      receivableId,
      targetStatus: RECEIVABLE_STATUS.PROCESSING,
    });
    await executeSystemAdvanceSettlement(deps, {
      receivableId,
      targetStatus: RECEIVABLE_STATUS.COMPLETED,
    });

    // 6. Run Payer Settlement
    await executeSystemPayerSettlement(deps, {
      receivableId,
      outcome: "settled",
    });

    // 7. Verify receivable status is payer_settled
    [recRow] = await deps.db.select().from(receivables).where(eq(receivables.id, receivableId));
    assert.equal(recRow.status, "payer_settled");

    // 8. Verify investment statuses are settled
    const investments = await deps.db
      .select()
      .from(investorInvestments)
      .where(eq(investorInvestments.receivableId, receivableId));
    assert.equal(investments.length, 2);
    assert.ok(investments.every((i) => i.status === "settled"));

    // 9. Verify investor balances include simple interest pro-rata over 15 days (30-day month)
    // Principal A = 25000 cents, rate = 1% a.m., days = 15
    // Interest A = Math.round(25000 * (0.01 / 30) * 15) = 125 cents
    // Final balance A = (50000 - 25000) + 25000 + 125 = 50125 cents
    const [invARow] = await deps.db.select().from(investors).where(eq(investors.id, invA.investorId));
    assert.equal(invARow.balanceCents, 50125);

    // Principal B = 15000 cents
    // Interest B = Math.round(15000 * (0.01 / 30) * 15) = 75 cents
    // Final balance B = (30000 - 15000) + 15000 + 75 = 30075 cents
    const [invBRow] = await deps.db.select().from(investors).where(eq(investors.id, invB.investorId));
    assert.equal(invBRow.balanceCents, 30075);
  } finally {
    await handle.close();
  }
});
