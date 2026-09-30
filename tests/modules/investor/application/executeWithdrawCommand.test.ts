import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { loadConfig } from "../../../../src/infra/env/config.js";
import { createDb, runMigrations } from "../../../../src/infra/database/index.js";
import { investors } from "../../../../src/infra/database/schema.runtime.js";
import { executeDeposit } from "../../../../src/modules/investor/application/commands/executeDepositCommand.js";
import { executeWithdraw } from "../../../../src/modules/investor/application/commands/executeWithdrawCommand.js";
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

test("executeWithdraw - successful withdrawal decrements balance", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { accountId, investorId } = await insertInvestor(deps);

    // Deposit some money first
    await executeDeposit(deps, {
      accountId,
      amountReais: 200.00,
      idempotencyKey: "dep-key",
    });

    const result = await executeWithdraw(deps, {
      accountId,
      amountReais: 50.50,
      idempotencyKey: "withdraw-key-1",
      pixKey: "pix-1",
    });

    assert.ok(result.id);
    assert.equal(result.investorId, investorId);
    assert.equal(result.amount, 50.50);
    assert.equal(result.pixKey, "pix-1");
    assert.equal(result.status, "completed");

    // Verify balance updated in DB
    const [inv] = await deps.db
      .select()
      .from(investors)
      .where(eq(investors.id, investorId))
      .limit(1);
    assert.equal(inv?.balanceCents, 14950); // 20000 - 5050

    // Query investor
    const profile = await executeGetInvestor(deps, accountId);
    assert.equal(profile.balance, 149.50);
  } finally {
    await handle.close();
  }
});

test("executeWithdraw - idempotency returns same result and prevents double deduction", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { accountId, investorId } = await insertInvestor(deps);

    // Deposit first
    await executeDeposit(deps, {
      accountId,
      amountReais: 100.00,
      idempotencyKey: "dep-key",
    });

    const result1 = await executeWithdraw(deps, {
      accountId,
      amountReais: 40.00,
      idempotencyKey: "same-withdraw-key",
      pixKey: "pix-1",
    });

    const result2 = await executeWithdraw(deps, {
      accountId,
      amountReais: 40.00,
      idempotencyKey: "same-withdraw-key",
      pixKey: "pix-1",
    });

    assert.equal(result1.id, result2.id);
    assert.equal(result1.amount, result2.amount);

    // Balance should only have decremented once (100 - 40 = 60 reais = 6000 cents)
    const [inv] = await deps.db
      .select()
      .from(investors)
      .where(eq(investors.id, investorId))
      .limit(1);
    assert.equal(inv?.balanceCents, 6000);
  } finally {
    await handle.close();
  }
});

test("executeWithdraw - throws insufficient_funds if amount exceeds balance", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { accountId } = await insertInvestor(deps);

    // Balance is 0. Attempt 10 reais withdrawal.
    await assert.rejects(
      executeWithdraw(deps, {
        accountId,
        amountReais: 10.00,
        idempotencyKey: "w-key",
        pixKey: "pix-1",
      }),
      /insufficient_funds/,
    );
  } finally {
    await handle.close();
  }
});

test("executeWithdraw - throws if amount is zero or negative", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { accountId } = await insertInvestor(deps);
    await assert.rejects(
      executeWithdraw(deps, {
        accountId,
        amountReais: -5.00,
        idempotencyKey: "w-key",
        pixKey: "pix-1",
      }),
      /invalid_amount/,
    );
  } finally {
    await handle.close();
  }
});
