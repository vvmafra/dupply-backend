import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeAdminOpenFunding } from "../../../../src/modules/receivable/application/commands/adminOpenFundingCommand.js";
import { executeRiskDecision } from "../../../../src/modules/receivable/application/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../../../src/modules/receivable/application/commands/sellerDecisionCommand.js";
import { executeSubmitReceivable } from "../../../../src/modules/receivable/application/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../../../src/modules/receivable/application/commands/updateReceivableDraftCommand.js";
import { receivables } from "../../../../src/infra/database/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../../src/modules/receivable/domain/errors.js";
import {
  RECEIVABLE_STATUS,
  ReceivableTransitionError,
} from "../../../../src/modules/receivable/domain/transitions.js";
import {
  completeReceivableMetaData,
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../../helpers/receivableTestHelpers.js";

type Deps = Awaited<ReturnType<typeof createTestContext>>["deps"];

async function offeredReceivable(deps: Deps, sellerId: string, proposedValue?: number) {
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
    proposedValue: proposedValue ?? 450,
  });
  return id;
}

async function confirmedReceivable(deps: Deps, sellerId: string, proposedValue?: number) {
  const id = await offeredReceivable(deps, sellerId, proposedValue);
  await executeSellerDecision(deps, {
    receivableId: id,
    profileId: sellerId,
    actorRole: "seller",
    decision: "accept",
  });
  return id;
}

test("admin open funding: confirmed → funding, target from proposedValue", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await confirmedReceivable(deps, sellerId, 450);

    const result = await executeAdminOpenFunding(deps, { receivableId: id });
    assert.deepEqual(result, {
      from: RECEIVABLE_STATUS.CONFIRMED,
      to: RECEIVABLE_STATUS.FUNDING,
      targetFundingCents: 45000,
      yieldRateMonthly: 0,
      minInvestmentCents: 0,
    });

    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.FUNDING);
    assert.equal(row?.targetFundingCents, 45000);
    assert.equal(row?.fundedCents, 0);
    const history = JSON.parse(row?.statusHistory ?? "{}") as Record<string, string>;
    assert.ok(history.funding, "statusHistory records funding timestamp");
  } finally {
    await handle.close();
  }
});

test("admin open funding: keeps an existing non-zero targetFundingCents and fundedCents", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await confirmedReceivable(deps, sellerId);
    await deps.db
      .update(receivables)
      .set({ targetFundingCents: 99000, fundedCents: 1000 })
      .where(eq(receivables.id, id));

    const result = await executeAdminOpenFunding(deps, { receivableId: id });
    assert.equal(result.targetFundingCents, 99000);

    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.targetFundingCents, 99000);
    assert.equal(row?.fundedCents, 1000);
  } finally {
    await handle.close();
  }
});

test("admin open funding: falls back to value when proposedValue is null", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await confirmedReceivable(deps, sellerId);
    await deps.db.update(receivables).set({ proposedValue: null }).where(eq(receivables.id, id));

    const result = await executeAdminOpenFunding(deps, { receivableId: id });
    // draft value is 500 reais (createDraftReceivable default)
    assert.equal(result.targetFundingCents, 50000);
  } finally {
    await handle.close();
  }
});

test("admin open funding: rejects receivable not in confirmed", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await offeredReceivable(deps, sellerId);

    await assert.rejects(
      executeAdminOpenFunding(deps, { receivableId: id }),
      (e: unknown) => e instanceof ReceivableTransitionError,
    );
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.OFFER);
  } finally {
    await handle.close();
  }
});

test("admin open funding: unknown receivable → not_found", async () => {
  const { deps, handle } = await createTestContext();
  try {
    await assert.rejects(
      executeAdminOpenFunding(deps, { receivableId: "missing" }),
      (e: unknown) =>
        e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.NOT_FOUND,
    );
  } finally {
    await handle.close();
  }
});

test("admin open funding: keeps analyst terms and allows overriding them", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await confirmedReceivable(deps, sellerId, 450);
    await deps.db
      .update(receivables)
      .set({ yieldRateMonthly: 0.015, minInvestmentCents: 5000 })
      .where(eq(receivables.id, id));

    const result = await executeAdminOpenFunding(deps, { receivableId: id, minInvestment: 100 });
    assert.equal(result.yieldRateMonthly, 0.015, "analyst rate kept");
    assert.equal(result.minInvestmentCents, 10000, "ticket overridden");

    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.yieldRateMonthly, 0.015);
    assert.equal(row?.minInvestmentCents, 10000);
  } finally {
    await handle.close();
  }
});

test("admin open funding: minInvestment above the target is rejected and nothing changes", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await confirmedReceivable(deps, sellerId, 450);

    await assert.rejects(
      executeAdminOpenFunding(deps, { receivableId: id, minInvestment: 450.01 }),
      (e: unknown) =>
        e instanceof ReceivableError && e.code === RECEIVABLE_ERROR_CODES.INVALID_OFFER_TERMS,
    );
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.CONFIRMED);
  } finally {
    await handle.close();
  }
});
