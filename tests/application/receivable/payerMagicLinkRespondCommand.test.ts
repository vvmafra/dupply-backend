import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executePayerMagicLinkRespond } from "../../../src/application/receivable/commands/payerMagicLinkRespondCommand.js";
import { executeRiskDecision } from "../../../src/application/receivable/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../../src/application/receivable/commands/sellerDecisionCommand.js";
import { executeSubmitReceivable } from "../../../src/application/receivable/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../../src/application/receivable/commands/updateReceivableDraftCommand.js";
import { encodeStubMagicLinkToken } from "../../../src/application/payer/ports/magicLinkToken.js";
import { receivables } from "../../../src/db/schema.runtime.js";
import { PAYER_ERROR_CODES, PayerError } from "../../../src/domain/payer/errors.js";
import { RECEIVABLE_STATUS } from "../../../src/domain/receivable/transitions.js";
import {
  completeReceivableMetaData,
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";

async function approvedReceivable(deps: Awaited<ReturnType<typeof createTestContext>>["deps"], sellerId: string) {
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
  return { id, payerId: row!.payerId };
}

test("payer magic-link accept transitions approved → confirmed", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const { id, payerId } = await approvedReceivable(deps, sellerId);
    const token = encodeStubMagicLinkToken({ receivableId: id, payerId });
    await executePayerMagicLinkRespond(deps, { token, decision: "accept" });
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.CONFIRMED);
  } finally {
    await handle.close();
  }
});

test("invalid token throws from port", async () => {
  const { deps, handle } = await createTestContext();
  try {
    await assert.rejects(
      () => executePayerMagicLinkRespond(deps, { token: "bad-token", decision: "accept" }),
      (e: unknown) => {
        assert.ok(e instanceof PayerError);
        assert.equal(e.code, PAYER_ERROR_CODES.INVALID_TOKEN);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
