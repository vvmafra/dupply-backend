import assert from "node:assert/strict";
import test from "node:test";

import { executeListReceivables } from "../../../src/application/receivable/queries/listReceivablesQuery.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../src/domain/receivable/errors.js";
import {
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";

test("seller list returns only own receivables", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const sellerA = await setupActiveSeller(deps);
    const sellerB = await setupActiveSeller(deps);
    await createDraftReceivable(deps, sellerA.sellerId);
    await createDraftReceivable(deps, sellerB.sellerId);

    const rows = await executeListReceivables(deps, {
      profileId: sellerA.sellerId,
      role: "seller",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.sellerId, sellerA.sellerId);
  } finally {
    await handle.close();
  }
});

test("payer role is forbidden on list", async () => {
  const { deps, handle } = await createTestContext();
  try {
    await assert.rejects(
      () =>
        executeListReceivables(deps, {
          profileId: "payer-1",
          role: "payer",
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

test("admin sees all receivables", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const sellerA = await setupActiveSeller(deps);
    const sellerB = await setupActiveSeller(deps);
    await createDraftReceivable(deps, sellerA.sellerId);
    await createDraftReceivable(deps, sellerB.sellerId);
    const { id: adminId } = await insertAccount(deps, { role: "admin" });
    const rows = await executeListReceivables(deps, {
      profileId: adminId,
      role: "admin",
    });
    assert.equal(rows.length, 2);
  } finally {
    await handle.close();
  }
});
