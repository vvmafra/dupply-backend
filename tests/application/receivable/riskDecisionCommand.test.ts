import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeRiskDecision } from "../../../src/application/receivable/commands/riskDecisionCommand.js";
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

async function submitDraft(deps: Awaited<ReturnType<typeof createTestContext>>["deps"], sellerId: string) {
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
  return id;
}

test("risk offer sets proposedValue and status offer", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await submitDraft(deps, sellerId);
    await executeRiskDecision(deps, {
      receivableId: id,
      actorRole: "risk_analyst",
      decision: "offer",
      proposedValue: 450,
    });
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.OFFER);
    assert.equal(row?.proposedValue, "45000");
  } finally {
    await handle.close();
  }
});

test("offer without proposedValue throws", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await submitDraft(deps, sellerId);
    await assert.rejects(
      () =>
        executeRiskDecision(deps, {
          receivableId: id,
          actorRole: "risk_analyst",
          decision: "offer",
        }),
      (e: unknown) => {
        assert.ok(e instanceof ReceivableError);
        assert.equal(e.code, RECEIVABLE_ERROR_CODES.PROPOSED_VALUE_REQUIRED);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("reprove with proposedValue throws", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await submitDraft(deps, sellerId);
    await assert.rejects(
      () =>
        executeRiskDecision(deps, {
          receivableId: id,
          actorRole: "risk_analyst",
          decision: "reprove",
          proposedValue: 0.01,
        }),
      (e: unknown) => {
        assert.ok(e instanceof ReceivableError);
        assert.equal(e.code, RECEIVABLE_ERROR_CODES.PROPOSED_VALUE_FORBIDDEN);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
