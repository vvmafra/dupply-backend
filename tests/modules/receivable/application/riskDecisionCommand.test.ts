import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeRiskDecision } from "../../../../src/modules/receivable/application/commands/riskDecisionCommand.js";
import { executeSubmitReceivable } from "../../../../src/modules/receivable/application/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../../../src/modules/receivable/application/commands/updateReceivableDraftCommand.js";
import { receivables } from "../../../../src/infra/database/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../../src/modules/receivable/domain/errors.js";
import { RECEIVABLE_STATUS } from "../../../../src/modules/receivable/domain/transitions.js";
import {
  completeReceivableMetaData,
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../../helpers/receivableTestHelpers.js";

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

test("risk offer stores yieldRateMonthly and minInvestment (cents) with the proposal", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await submitDraft(deps, sellerId);
    await executeRiskDecision(deps, {
      receivableId: id,
      actorRole: "risk_analyst",
      decision: "offer",
      proposedValue: 450,
      yieldRateMonthly: 0.018,
      minInvestment: 50,
    });
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.OFFER);
    assert.equal(row?.yieldRateMonthly, 0.018);
    assert.equal(row?.minInvestmentCents, 5000);
  } finally {
    await handle.close();
  }
});

test("risk offer without terms leaves them at 0", async () => {
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
    assert.equal(row?.yieldRateMonthly, 0);
    assert.equal(row?.minInvestmentCents, 0);
  } finally {
    await handle.close();
  }
});

test("risk offer with minInvestment above proposedValue throws invalid_offer_terms", async () => {
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
          proposedValue: 450,
          minInvestment: 450.01,
        }),
      (e: unknown) =>
        e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.INVALID_OFFER_TERMS,
    );
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.UNDER_REVIEW);
  } finally {
    await handle.close();
  }
});

test("reprove with offer terms throws offer_terms_not_allowed_for_reprove", async () => {
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
          yieldRateMonthly: 0.01,
        }),
      (e: unknown) =>
        e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.OFFER_TERMS_FORBIDDEN,
    );
  } finally {
    await handle.close();
  }
});
