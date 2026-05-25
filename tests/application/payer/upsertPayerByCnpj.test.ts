import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { upsertPayerByCnpj } from "../../../src/application/payer/commands/upsertPayerByCnpj.js";
import { payers } from "../../../src/db/schema.runtime.js";
import { PAYER_ERROR_CODES, PayerError } from "../../../src/domain/payer/errors.js";
import { createTestContext, PAYER_CNPJ } from "../../helpers/receivableTestHelpers.js";

test("creates new payer by CNPJ", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const result = await upsertPayerByCnpj(deps, {
      cnpj: PAYER_CNPJ,
      legalName: "Payer Corp",
      email: "finance@payer.com",
    });
    assert.equal(result.created, true);
    const [row] = await deps.db.select().from(payers).where(eq(payers.id, result.payerId));
    assert.equal(row?.cnpj, PAYER_CNPJ);
  } finally {
    await handle.close();
  }
});

test("reuses existing payer without overwriting legalName/email", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const first = await upsertPayerByCnpj(deps, {
      cnpj: PAYER_CNPJ,
      legalName: "Original Name",
      email: "original@payer.com",
    });
    const second = await upsertPayerByCnpj(deps, {
      cnpj: PAYER_CNPJ,
      legalName: "New Name",
      email: "new@payer.com",
    });
    assert.equal(first.payerId, second.payerId);
    assert.equal(second.created, false);
    const [row] = await deps.db.select().from(payers).where(eq(payers.id, first.payerId));
    assert.equal(row?.legalName, "Original Name");
    assert.equal(row?.email, "original@payer.com");
  } finally {
    await handle.close();
  }
});

test("soft-deleted payer throws INACTIVE", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { payerId } = await upsertPayerByCnpj(deps, {
      cnpj: PAYER_CNPJ,
      legalName: "Payer Corp",
      email: "finance@payer.com",
    });
    await deps.db
      .update(payers)
      .set({ deletedAt: new Date() })
      .where(eq(payers.id, payerId));

    await assert.rejects(
      () =>
        upsertPayerByCnpj(deps, {
          cnpj: PAYER_CNPJ,
          legalName: "Payer Corp",
          email: "finance@payer.com",
        }),
      (e: unknown) => {
        assert.ok(e instanceof PayerError);
        assert.equal(e.code, PAYER_ERROR_CODES.INACTIVE);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
