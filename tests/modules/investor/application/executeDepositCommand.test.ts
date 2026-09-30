import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { loadConfig } from "../../../../src/infra/env/config.js";
import { createDb, runMigrations } from "../../../../src/infra/database/index.js";
import { investors } from "../../../../src/infra/database/schema.runtime.js";
import { executeDeposit } from "../../../../src/modules/investor/application/commands/executeDepositCommand.js";
import { executeGetInvestor } from "../../../../src/modules/investor/application/queries/executeGetInvestorQuery.js";
import { insertInvestor } from "../../../helpers/investorTestHelpers.js";
import { createGateways } from "../../../../src/infra/gateways/factories/createGateways.js";
import type { AppDeps } from "../../../../src/compose/deps.js";

async function createTestContext() {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({
    JWT_SECRET: "test-secret-min-16-chars",
    DATABASE_URL: "file::memory:",
  });
  const deps: AppDeps = { db: handle.db, config, gateways: createGateways(config) };
  return { deps, handle };
}

test("executeDeposit - successful deposit increments balance", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { accountId, investorId } = await insertInvestor(deps);

    const result = await executeDeposit(deps, {
      accountId,
      amountReais: 150.50,
      idempotencyKey: "dep-1",
      externalTxId: "tx-123",
    });

    assert.ok(result.id);
    assert.equal(result.investorId, investorId);
    assert.equal(result.amount, 150.50);
    assert.equal(result.status, "completed");

    // Verify balance updated in DB
    const [inv] = await deps.db
      .select()
      .from(investors)
      .where(eq(investors.id, investorId))
      .limit(1);
    assert.equal(inv?.balanceCents, 15050);

    // Query investor
    const profile = await executeGetInvestor(deps, accountId);
    assert.equal(profile.balance, 150.50);
  } finally {
    await handle.close();
  }
});

test("executeDeposit - idempotency returns same result and prevents double deposit", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { accountId, investorId } = await insertInvestor(deps);

    const result1 = await executeDeposit(deps, {
      accountId,
      amountReais: 50.00,
      idempotencyKey: "same-key",
    });

    const result2 = await executeDeposit(deps, {
      accountId,
      amountReais: 50.00,
      idempotencyKey: "same-key",
    });

    assert.equal(result1.id, result2.id);
    assert.equal(result1.amount, result2.amount);

    // Balance should only have incremented once (5000 cents, not 10000 cents)
    const [inv] = await deps.db
      .select()
      .from(investors)
      .where(eq(investors.id, investorId))
      .limit(1);
    assert.equal(inv?.balanceCents, 5000);
  } finally {
    await handle.close();
  }
});

test("executeDeposit - throws if investor does not exist", async () => {
  const { deps, handle } = await createTestContext();
  try {
    await assert.rejects(
      executeDeposit(deps, {
        accountId: "non-existent-acc",
        amountReais: 10.00,
        idempotencyKey: "key-1",
      }),
      /investor_not_found/,
    );
  } finally {
    await handle.close();
  }
});

test("executeDeposit - throws if amount is zero or negative", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { accountId } = await insertInvestor(deps);
    await assert.rejects(
      executeDeposit(deps, {
        accountId,
        amountReais: -5.00,
        idempotencyKey: "key-1",
      }),
      /invalid_amount/,
    );
  } finally {
    await handle.close();
  }
});
