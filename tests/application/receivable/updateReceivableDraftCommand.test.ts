import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeUpdateReceivableDraft } from "../../../src/application/receivable/commands/updateReceivableDraftCommand.js";
import { executeRiskDecision } from "../../../src/application/receivable/commands/riskDecisionCommand.js";
import { receivables } from "../../../src/db/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../src/domain/receivable/errors.js";
import { RECEIVABLE_STATUS } from "../../../src/domain/receivable/transitions.js";
import {
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";

test("updates draft metadata and value", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await createDraftReceivable(deps, sellerId);
    await executeUpdateReceivableDraft(deps, {
      receivableId: id,
      profileId: sellerId,
      value: 750,
      receivableMetaData: { billNumber: "BILL-UPDATED" },
    });
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.value, "75000");
    assert.match(row?.receivableMetaData ?? "", /BILL-UPDATED/);
  } finally {
    await handle.close();
  }
});

test("update on non-created status throws METADATA_LOCKED", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await createDraftReceivable(deps, sellerId);
    await executeRiskDecision(deps, {
      receivableId: id,
      actorRole: "risk_analyst",
      decision: "reprove",
    }).catch(() => undefined);

    await deps.db
      .update(receivables)
      .set({ status: RECEIVABLE_STATUS.UNDER_REVIEW, updatedAt: new Date() })
      .where(eq(receivables.id, id));

    await assert.rejects(
      () =>
        executeUpdateReceivableDraft(deps, {
          receivableId: id,
          profileId: sellerId,
          value: 0.01,
        }),
      (e: unknown) => {
        assert.ok(e instanceof ReceivableError);
        assert.equal(e.code, RECEIVABLE_ERROR_CODES.METADATA_LOCKED);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("PATCH changing billNumber to collide with another active receivable throws duplicate error", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const firstId = await createDraftReceivable(deps, sellerId, {
      receivableMetaData: { billNumber: "FIRST-BILL" },
    });
    const secondId = await createDraftReceivable(deps, sellerId, {
      receivableMetaData: { billNumber: "SECOND-BILL" },
    });
    assert.notEqual(firstId, secondId);

    await assert.rejects(
      () =>
        executeUpdateReceivableDraft(deps, {
          receivableId: secondId,
          profileId: sellerId,
          receivableMetaData: { billNumber: "first-bill" },
        }),
      (e: unknown) => {
        assert.ok(e instanceof ReceivableError);
        assert.equal(e.code, RECEIVABLE_ERROR_CODES.DUPLICATE_BILL_NUMBER);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("PATCH updating only value does not invoke duplicate guard", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await createDraftReceivable(deps, sellerId, {
      receivableMetaData: { billNumber: "ONLY-VALUE" },
    });
    await createDraftReceivable(deps, sellerId, {
      receivableMetaData: { billNumber: "OTHER-BILL" },
    });

    await executeUpdateReceivableDraft(deps, {
      receivableId: id,
      profileId: sellerId,
      value: 999,
    });
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.value, "99900");
  } finally {
    await handle.close();
  }
});
