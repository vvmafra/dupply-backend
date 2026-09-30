import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeRegisterSeller } from "../../../../src/modules/seller/application/commands/registerSellerCommand.js";
import { loadConfig } from "../../../../src/infra/env/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../../src/infra/database/index.js";
import { accounts, sellers } from "../../../../src/infra/database/schema.runtime.js";
import type { AppDeps } from "../../../../src/compose/deps.js";
import { TEST_PASSWORD } from "../../../helpers/sellerTestHelpers.js";
import { createGateways } from "../../../../src/infra/gateways/factories/createGateways.js";

async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({
    JWT_SECRET: "test-secret-min-16-chars",
    DATABASE_URL: "file::memory:",
  });
  return { deps: { db: handle.db, config, gateways: createGateways(config) }, handle };
}

test("executeRegisterSeller creates account and seller atomically", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const result = await executeRegisterSeller(deps, {
      email: "seller@example.com",
      password: TEST_PASSWORD,
      name: "Minha Empresa",
    });

    const [account] = await deps.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, result.accountId))
      .limit(1);
    const [seller] = await deps.db
      .select()
      .from(sellers)
      .where(eq(sellers.id, result.sellerId))
      .limit(1);

    assert.ok(account);
    assert.equal(account.role, "seller");
    assert.equal(account.status, "active");
    assert.ok(seller);
    assert.equal(seller.accountId, result.accountId);
    assert.equal(seller.status, "created");
    assert.equal(seller.name, "Minha Empresa");
  } finally {
    await handle.close();
  }
});

test("executeRegisterSeller rolls back on duplicate email", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const input = {
      email: "dup@example.com",
      password: TEST_PASSWORD,
      name: "Empresa",
    };
    await executeRegisterSeller(deps, input);

    await assert.rejects(() => executeRegisterSeller(deps, input));

    const accountRows = await deps.db
      .select()
      .from(accounts)
      .where(eq(accounts.email, input.email));
    const sellerRows = await deps.db.select().from(sellers);
    assert.equal(accountRows.length, 1);
    assert.equal(sellerRows.length, 1);
  } finally {
    await handle.close();
  }
});
