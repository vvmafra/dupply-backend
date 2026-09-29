import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeAdminAdvanceStage } from "../../../../src/modules/receivable/application/commands/adminAdvanceStageCommand.js";
import { executeAdminOpenFunding } from "../../../../src/modules/receivable/application/commands/adminOpenFundingCommand.js";
import { executeRiskDecision } from "../../../../src/modules/receivable/application/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../../../src/modules/receivable/application/commands/sellerDecisionCommand.js";
import { executeSubmitReceivable } from "../../../../src/modules/receivable/application/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../../../src/modules/receivable/application/commands/updateReceivableDraftCommand.js";
import { executeInvest } from "../../../../src/modules/investor/application/commands/executeInvestCommand.js";
import {
  investorInvestments,
  investors,
  receivables,
} from "../../../../src/infra/database/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../../src/modules/receivable/domain/errors.js";
import {
  RECEIVABLE_STATUS,
  ReceivableTransitionError,
} from "../../../../src/modules/receivable/domain/transitions.js";
import { insertInvestor } from "../../../helpers/investorTestHelpers.js";
import {
  completeReceivableMetaData,
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../../helpers/receivableTestHelpers.js";

type Deps = Awaited<ReturnType<typeof createTestContext>>["deps"];

async function confirmedReceivable(deps: Deps, sellerId: string) {
  const id = await createDraftReceivable(deps, sellerId);
  await executeUpdateReceivableDraft(deps, {
    receivableId: id,
    profileId: sellerId,
    receivableMetaData: completeReceivableMetaData,
  });
  await executeSubmitReceivable(deps, { receivableId: id, profileId: sellerId, actorRole: "seller" });
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
  return id;
}

/** confirmed → (admin open funding) → funding → (investor fully funds) → funded */
async function fundedReceivable(deps: Deps, sellerId: string) {
  const id = await confirmedReceivable(deps, sellerId);
  await executeAdminOpenFunding(deps, { receivableId: id });

  const inv = await insertInvestor(deps, { name: "Investor A" });
  await deps.db.update(investors).set({ balanceCents: 100000 }).where(eq(investors.id, inv.investorId));
  await executeInvest(deps, {
    accountId: inv.accountId,
    receivableId: id,
    amountReais: 450,
    idempotencyKey: "key-a",
  });

  const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
  assert.equal(row?.status, RECEIVABLE_STATUS.FUNDED);
  return { id, investorId: inv.investorId };
}

async function statusOf(deps: Deps, id: string) {
  const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
  return row?.status;
}

test("admin advance stage: funded → processing → completed → payer_settled, with payout", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const { id, investorId } = await fundedReceivable(deps, sellerId);

    const [beforeInvestor] = await deps.db.select().from(investors).where(eq(investors.id, investorId));
    assert.equal(beforeInvestor?.balanceCents, 100000 - 45000);

    let result = await executeAdminAdvanceStage(deps, { receivableId: id });
    assert.deepEqual(result, { from: "funded", to: "processing" });
    assert.equal(await statusOf(deps, id), RECEIVABLE_STATUS.PROCESSING);

    result = await executeAdminAdvanceStage(deps, { receivableId: id });
    assert.deepEqual(result, { from: "processing", to: "completed" });
    assert.equal(await statusOf(deps, id), RECEIVABLE_STATUS.COMPLETED);

    result = await executeAdminAdvanceStage(deps, { receivableId: id });
    assert.deepEqual(result, { from: "completed", to: "payer_settled" });
    assert.equal(await statusOf(deps, id), RECEIVABLE_STATUS.PAYER_SETTLED);

    // payout ran: principal (yield 0 by default) returned, investment settled
    const [afterInvestor] = await deps.db.select().from(investors).where(eq(investors.id, investorId));
    assert.ok(
      (afterInvestor?.balanceCents ?? 0) >= 100000,
      `expected principal back, got ${afterInvestor?.balanceCents}`,
    );
    const [investment] = await deps.db
      .select()
      .from(investorInvestments)
      .where(eq(investorInvestments.receivableId, id));
    assert.equal(investment?.status, "settled");

    // every system transition is recorded in statusHistory (same shape as the seed)
    const [settledRow] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    const history = JSON.parse(settledRow?.statusHistory ?? "{}") as Record<string, string>;
    for (const s of ["funding", "funded", "processing", "completed", "payer_settled"]) {
      assert.ok(history[s], `statusHistory.${s} recorded`);
    }

    // terminal: a fourth call is rejected and status is unchanged
    await assert.rejects(
      executeAdminAdvanceStage(deps, { receivableId: id }),
      (e: unknown) =>
        e instanceof ReceivableTransitionError && e.message === "invalid_admin_stage_advance",
    );
    assert.equal(await statusOf(deps, id), RECEIVABLE_STATUS.PAYER_SETTLED);
  } finally {
    await handle.close();
  }
});

test("admin advance stage: rejects confirmed and funding (use open-funding / investor flow)", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await confirmedReceivable(deps, sellerId);

    await assert.rejects(
      executeAdminAdvanceStage(deps, { receivableId: id }),
      (e: unknown) => e instanceof ReceivableTransitionError,
    );
    assert.equal(await statusOf(deps, id), RECEIVABLE_STATUS.CONFIRMED);

    await executeAdminOpenFunding(deps, { receivableId: id });
    await assert.rejects(
      executeAdminAdvanceStage(deps, { receivableId: id }),
      (e: unknown) => e instanceof ReceivableTransitionError,
    );
    assert.equal(await statusOf(deps, id), RECEIVABLE_STATUS.FUNDING);
  } finally {
    await handle.close();
  }
});

test("admin advance stage: unknown receivable → not_found", async () => {
  const { deps, handle } = await createTestContext();
  try {
    await assert.rejects(
      executeAdminAdvanceStage(deps, { receivableId: "missing" }),
      (e: unknown) =>
        e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.NOT_FOUND,
    );
  } finally {
    await handle.close();
  }
});

test("admin advance stage: overdue → payer_settled (late payment) with payout", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const { id, investorId } = await fundedReceivable(deps, sellerId);
    await deps.db
      .update(receivables)
      .set({ status: RECEIVABLE_STATUS.OVERDUE })
      .where(eq(receivables.id, id));

    const result = await executeAdminAdvanceStage(deps, { receivableId: id });
    assert.deepEqual(result, { from: "overdue", to: "payer_settled" });
    assert.equal(await statusOf(deps, id), RECEIVABLE_STATUS.PAYER_SETTLED);

    const [investment] = await deps.db
      .select()
      .from(investorInvestments)
      .where(eq(investorInvestments.receivableId, id));
    assert.equal(investment?.status, "settled");
    const [investor] = await deps.db.select().from(investors).where(eq(investors.id, investorId));
    assert.ok((investor?.balanceCents ?? 0) >= 100000, "principal returned");
  } finally {
    await handle.close();
  }
});
