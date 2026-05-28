import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

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

test("submit transitions created → under_review", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
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
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.UNDER_REVIEW);
  } finally {
    await handle.close();
  }
});

test("submit with incomplete metadata throws INCOMPLETE_METADATA", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await createDraftReceivable(deps, sellerId);
    await assert.rejects(
      () =>
        executeSubmitReceivable(deps, {
          receivableId: id,
          profileId: sellerId,
          actorRole: "seller",
        }),
      (e: unknown) => {
        assert.ok(e instanceof ReceivableError);
        assert.equal(e.code, RECEIVABLE_ERROR_CODES.INCOMPLETE_METADATA);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("submit blocked when keys collide with another active receivable", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    await createDraftReceivable(deps, sellerId, {
      receivableMetaData: { billNumber: "SUBMIT-COLLIDE" },
    });
    const secondId = await createDraftReceivable(deps, sellerId, {
      receivableMetaData: { billNumber: "OTHER-BILL" },
    });
    await deps.db
      .update(receivables)
      .set({
        receivableMetaData: JSON.stringify({
          ...completeReceivableMetaData,
          billNumber: "SUBMIT-COLLIDE",
          fiscalDocumentKey: "99999999999999999999999999999999999999999999",
        }),
        updatedAt: new Date(),
      })
      .where(eq(receivables.id, secondId));

    await assert.rejects(
      () =>
        executeSubmitReceivable(deps, {
          receivableId: secondId,
          profileId: sellerId,
          actorRole: "seller",
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
