import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeCreateAndSubmitReceivable } from "../../../src/application/receivable/commands/createAndSubmitReceivableCommand.js";
import { receivables } from "../../../src/db/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../src/domain/receivable/errors.js";
import { RECEIVABLE_STATUS } from "../../../src/domain/receivable/transitions.js";
import { SellerError, SELLER_ERROR_CODES } from "../../../src/domain/seller/errors.js";
import {
  completeCompanyMetaData,
  completeReceivableMetaData,
  createTestContext,
  PAYER_CNPJ,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";

test("create and submit inserts receivable directly as under_review", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const { id, status } = await executeCreateAndSubmitReceivable(deps, {
      profileId: sellerId,
      payerCnpj: PAYER_CNPJ,
      payerLegalName: "Payer Corp",
      payerFinancialEmail: "finance@payer.com",
      value: 500,
      receivableMetaData: completeReceivableMetaData,
    });
    assert.equal(status, RECEIVABLE_STATUS.UNDER_REVIEW);
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, RECEIVABLE_STATUS.UNDER_REVIEW);
    assert.equal(row?.sellerId, sellerId);
    assert.ok(row?.payerId);
    assert.ok(row?.receivableMetaData);
  } finally {
    await handle.close();
  }
});

test("create and submit with incomplete metadata throws INCOMPLETE_METADATA", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    await assert.rejects(
      () =>
        executeCreateAndSubmitReceivable(deps, {
          profileId: sellerId,
          payerCnpj: PAYER_CNPJ,
          payerLegalName: "Payer Corp",
          payerFinancialEmail: "finance@payer.com",
          value: 500,
          receivableMetaData: { type: "commercial" },
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

test("create and submit inactive seller throws NOT_ACTIVE", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await assert.rejects(
      () =>
        executeCreateAndSubmitReceivable(deps, {
          profileId: sellerId,
          payerCnpj: PAYER_CNPJ,
          payerLegalName: "Payer Corp",
          payerFinancialEmail: "finance@payer.com",
          value: 500,
          receivableMetaData: completeReceivableMetaData,
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

test("create and submit same seller/payer CNPJ throws SELLER_PAYER_MUST_DIFFER", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    await assert.rejects(
      () =>
        executeCreateAndSubmitReceivable(deps, {
          profileId: sellerId,
          payerCnpj: completeCompanyMetaData.cnpj,
          payerLegalName: "Same Corp",
          payerFinancialEmail: "same@corp.com",
          value: 500,
          receivableMetaData: {
            ...completeReceivableMetaData,
            payerCnpj: completeCompanyMetaData.cnpj,
          },
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
