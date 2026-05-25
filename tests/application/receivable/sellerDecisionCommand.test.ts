import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeRiskDecision } from "../../../src/application/receivable/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../../src/application/receivable/commands/sellerDecisionCommand.js";
import { executeSubmitReceivable } from "../../../src/application/receivable/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../../src/application/receivable/commands/updateReceivableDraftCommand.js";
import { receivables } from "../../../src/db/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../src/domain/receivable/errors.js";
import { RECEIVABLE_STATUS } from "../../../src/domain/receivable/transitions.js";
import {
  completeReceivableMetaData,
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";

async function offerDraft(deps: Awaited<ReturnType<typeof createTestContext>>["deps"], sellerId: string) {
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
    proposedValue: "45000",
  });
  return id;
}

test("seller accept transitions offer → approved", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await offerDraft(deps, sellerId);
    await executeSellerDecision(deps, {
      receivableId: id,
      profileId: sellerId,
      actorRole: "seller",
      decision: "accept",
    });
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.APPROVED);
  } finally {
    await handle.close();
  }
});

test("seller decision on non-owner receivable throws NOT_OWNER", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const other = await setupActiveSeller(deps);
    const id = await offerDraft(deps, sellerId);
    await assert.rejects(
      () =>
        executeSellerDecision(deps, {
          receivableId: id,
          profileId: other.sellerId,
          actorRole: "seller",
          decision: "accept",
        }),
      (e: unknown) => {
        assert.ok(e instanceof ReceivableError);
        assert.equal(e.code, RECEIVABLE_ERROR_CODES.NOT_OWNER);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
