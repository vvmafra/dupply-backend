import assert from "node:assert/strict";
import test from "node:test";

import { executeGetReceivable } from "../../../src/application/receivable/queries/getReceivableQuery.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../src/domain/receivable/errors.js";
import {
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";

test("seller can get own receivable", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await createDraftReceivable(deps, sellerId);
    const row = await executeGetReceivable(deps, {
      receivableId: id,
      actor: { profileId: sellerId, role: "seller" },
    });
    assert.equal(row.id, id);
  } finally {
    await handle.close();
  }
});

test("payer cannot get receivable via query", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await createDraftReceivable(deps, sellerId);
    await assert.rejects(
      () =>
        executeGetReceivable(deps, {
          receivableId: id,
          actor: { profileId: "payer-1", role: "payer" },
        }),
      (e: unknown) => {
        assert.ok(e instanceof ReceivableError);
        assert.equal(e.code, RECEIVABLE_ERROR_CODES.FORBIDDEN);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
