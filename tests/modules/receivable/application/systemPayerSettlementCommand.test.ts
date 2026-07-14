import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeSystemAdvanceSettlement } from "../../../../src/modules/receivable/application/commands/systemAdvanceSettlementCommand.js";
import { executeSystemPayerSettlement } from "../../../../src/modules/receivable/application/commands/systemPayerSettlementCommand.js";
import { executeRiskDecision } from "../../../../src/modules/receivable/application/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../../../src/modules/receivable/application/commands/sellerDecisionCommand.js";
import { executeSubmitReceivable } from "../../../../src/modules/receivable/application/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../../../src/modules/receivable/application/commands/updateReceivableDraftCommand.js";
import { receivables } from "../../../../src/infra/database/schema.runtime.js";
import { RECEIVABLE_STATUS } from "../../../../src/modules/receivable/domain/transitions.js";
import {
  completeReceivableMetaData,
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../../helpers/receivableTestHelpers.js";

async function completedReceivable(deps: Awaited<ReturnType<typeof createTestContext>>["deps"], sellerId: string) {
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
