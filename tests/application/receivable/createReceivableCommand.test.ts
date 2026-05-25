import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeCreateReceivable } from "../../../src/application/receivable/commands/createReceivableCommand.js";
import { receivables } from "../../../src/db/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../src/domain/receivable/errors.js";
import { RECEIVABLE_STATUS } from "../../../src/domain/receivable/transitions.js";
import { SellerError, SELLER_ERROR_CODES } from "../../../src/domain/seller/errors.js";
import {
  completeCompanyMetaData,
  createTestContext,
  PAYER_CNPJ,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";
import { sellers } from "../../../src/db/schema.runtime.js";

test("active seller creates draft with sellerId and payerId", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const { id } = await executeCreateReceivable(deps, {
      profileId: sellerId,
      payerCnpj: PAYER_CNPJ,
      payerLegalName: "Payer Corp",
      payerFinancialEmail: "finance@payer.com",
      value: "50000",
    });
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.CREATED);
    assert.ok(row?.sellerId);
    assert.ok(row?.payerId);
  } finally {
    await handle.close();
  }
});

test("inactive seller throws NOT_ACTIVE", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await assert.rejects(
      () =>
        executeCreateReceivable(deps, {
          profileId: sellerId,
          payerCnpj: PAYER_CNPJ,
          payerLegalName: "Payer Corp",
          payerFinancialEmail: "finance@payer.com",
        }),
      (e: unknown) => {
        assert.ok(e instanceof SellerError);
        assert.equal(e.code, SELLER_ERROR_CODES.NOT_ACTIVE);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("same seller/payer CNPJ throws SELLER_PAYER_MUST_DIFFER", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    await assert.rejects(
      () =>
        executeCreateReceivable(deps, {
          profileId: sellerId,
          payerCnpj: completeCompanyMetaData.cnpj,
          payerLegalName: "Same Corp",
          payerFinancialEmail: "same@corp.com",
        }),
      (e: unknown) => {
        assert.ok(e instanceof ReceivableError);
        assert.equal(e.code, RECEIVABLE_ERROR_CODES.SELLER_PAYER_MUST_DIFFER);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("soft-deleted seller cannot create receivable", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    await deps.db
      .update(sellers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    await assert.rejects(
      () =>
        executeCreateReceivable(deps, {
          profileId: sellerId,
          payerCnpj: PAYER_CNPJ,
          payerLegalName: "Payer Corp",
          payerFinancialEmail: "finance@payer.com",
        }),
      SellerError,
    );
  } finally {
    await handle.close();
  }
});
