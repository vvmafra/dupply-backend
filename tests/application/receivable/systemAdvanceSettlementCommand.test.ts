import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeSystemAdvanceSettlement } from "../../../src/application/receivable/commands/systemAdvanceSettlementCommand.js";
import { executePayerMagicLinkRespond } from "../../../src/application/receivable/commands/payerMagicLinkRespondCommand.js";
import { executeRiskDecision } from "../../../src/application/receivable/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../../src/application/receivable/commands/sellerDecisionCommand.js";
import { executeSubmitReceivable } from "../../../src/application/receivable/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../../src/application/receivable/commands/updateReceivableDraftCommand.js";
import { encodeStubMagicLinkToken } from "../../../src/application/payer/ports/magicLinkToken.js";
import { receivables } from "../../../src/db/schema.runtime.js";
import { RECEIVABLE_STATUS } from "../../../src/domain/receivable/transitions.js";
import {
  completeReceivableMetaData,
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";

async function confirmedReceivable(deps: Awaited<ReturnType<typeof createTestContext>>["deps"], sellerId: string) {
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
  const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
  const token = encodeStubMagicLinkToken({ receivableId: id, payerId: row!.payerId });
  await executePayerMagicLinkRespond(deps, { token, decision: "accept" });
  return id;
}

test("system advance confirmed → processing → completed", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await confirmedReceivable(deps, sellerId);
    await executeSystemAdvanceSettlement(deps, {
      receivableId: id,
      targetStatus: RECEIVABLE_STATUS.PROCESSING,
    });
    await executeSystemAdvanceSettlement(deps, {
      receivableId: id,
      targetStatus: RECEIVABLE_STATUS.COMPLETED,
    });
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.COMPLETED);
  } finally {
    await handle.close();
  }
});
