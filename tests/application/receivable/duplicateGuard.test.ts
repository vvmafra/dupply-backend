import assert from "node:assert/strict";
import test from "node:test";

import { createId } from "@paralleldrive/cuid2";

import {
  assertNoActiveReceivableDuplicate,
  isReceivableUniqueViolation,
} from "../../../src/application/receivable/duplicateGuard.js";
import { upsertPayerByCnpj } from "../../../src/application/payer/commands/upsertPayerByCnpj.js";
import { receivables } from "../../../src/db/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../../src/domain/receivable/errors.js";
import { RECEIVABLE_STATUS } from "../../../src/domain/receivable/transitions.js";
import {
  completeReceivableMetaData,
  createTestContext,
  PAYER_CNPJ,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";

async function ensurePayer(deps: Awaited<ReturnType<typeof createTestContext>>["deps"]): Promise<string> {
  const { payerId } = await upsertPayerByCnpj(deps, {
    cnpj: PAYER_CNPJ,
    legalName: "Payer Corp",
    email: "finance@payer.com",
  });
  return payerId;
}
async function insertReceivable(
  deps: Awaited<ReturnType<typeof createTestContext>>["deps"],
  input: {
    sellerId: string;
    payerId: string;
    status: string;
    normalizedBillNumber?: string | null;
    normalizedFiscalDocumentKey?: string | null;
    deletedAt?: Date | null;
  },
): Promise<string> {
  const id = createId();
  const now = new Date();
  await deps.db.insert(receivables).values({
    id,
    sellerId: input.sellerId,
    payerId: input.payerId,
    status: input.status,
    value: "50000",
    receivableMetaData: JSON.stringify(completeReceivableMetaData),
    normalizedBillNumber: input.normalizedBillNumber ?? null,
    normalizedFiscalDocumentKey: input.normalizedFiscalDocumentKey ?? null,
    proposedValue: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: input.deletedAt ?? null,
  });
  return id;
}

test("assertNoActiveReceivableDuplicate no-op when both keys null", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    await assertNoActiveReceivableDuplicate(deps, {
      sellerId,
      keys: { normalizedBillNumber: null, normalizedFiscalDocumentKey: null },
    });
  } finally {
    await handle.close();
  }
});

test("assertNoActiveReceivableDuplicate throws duplicate_bill_number on active collision", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const payerId = await ensurePayer(deps);
    await insertReceivable(deps, {
      sellerId,
      payerId,
      status: RECEIVABLE_STATUS.UNDER_REVIEW,
      normalizedBillNumber: "BILL-001",
    });

    await assert.rejects(
      () =>
        assertNoActiveReceivableDuplicate(deps, {
          sellerId,
          keys: { normalizedBillNumber: "BILL-001", normalizedFiscalDocumentKey: null },
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

test("assertNoActiveReceivableDuplicate allows resubmission after reproved", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const payerId = await ensurePayer(deps);
    await insertReceivable(deps, {
      sellerId,
      payerId,
      status: RECEIVABLE_STATUS.REPROVED,
      normalizedBillNumber: "BILL-001",
    });

    await assertNoActiveReceivableDuplicate(deps, {
      sellerId,
      keys: { normalizedBillNumber: "BILL-001", normalizedFiscalDocumentKey: null },
    });
  } finally {
    await handle.close();
  }
});

test("assertNoActiveReceivableDuplicate excludes self on update", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const payerId = await ensurePayer(deps);
    const id = await insertReceivable(deps, {
      sellerId,
      payerId,
      status: RECEIVABLE_STATUS.CREATED,
      normalizedBillNumber: "BILL-001",
    });

    await assertNoActiveReceivableDuplicate(deps, {
      sellerId,
      keys: { normalizedBillNumber: "BILL-001", normalizedFiscalDocumentKey: null },
      excludeReceivableId: id,
    });
  } finally {
    await handle.close();
  }
});

test("assertNoActiveReceivableDuplicate ignores different seller", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId: sellerA } = await setupActiveSeller(deps);
    const { sellerId: sellerB } = await insertAccount(deps);
    assert.ok(sellerB);
    const payerId = await ensurePayer(deps);
    await insertReceivable(deps, {
      sellerId: sellerA,
      payerId,
      status: RECEIVABLE_STATUS.CREATED,
      normalizedBillNumber: "BILL-001",
    });

    await assertNoActiveReceivableDuplicate(deps, {
      sellerId: sellerB,
      keys: { normalizedBillNumber: "BILL-001", normalizedFiscalDocumentKey: null },
    });
  } finally {
    await handle.close();
  }
});

test("assertNoActiveReceivableDuplicate ignores soft-deleted collision", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const payerId = await ensurePayer(deps);
    await insertReceivable(deps, {
      sellerId,
      payerId,
      status: RECEIVABLE_STATUS.CREATED,
      normalizedBillNumber: "BILL-001",
      deletedAt: new Date(),
    });

    await assertNoActiveReceivableDuplicate(deps, {
      sellerId,
      keys: { normalizedBillNumber: "BILL-001", normalizedFiscalDocumentKey: null },
    });
  } finally {
    await handle.close();
  }
});

test("isReceivableUniqueViolation maps bill index name", () => {
  assert.equal(
    isReceivableUniqueViolation(new Error("UNIQUE constraint failed: receivables_seller_bill_active_unique")),
    "bill",
  );
});

test("isReceivableUniqueViolation maps fiscal index name", () => {
  assert.equal(
    isReceivableUniqueViolation(
      new Error("UNIQUE constraint failed: receivables_seller_fiscal_key_active_unique"),
    ),
    "fiscal",
  );
});

test("isReceivableUniqueViolation returns null for unrelated errors", () => {
  assert.equal(isReceivableUniqueViolation(new Error("something else")), null);
});
