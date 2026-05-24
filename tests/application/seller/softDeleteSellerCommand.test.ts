import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeSoftDeleteSeller } from "../../../src/application/seller/commands/softDeleteSellerCommand.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers } from "../../../src/db/schema.runtime.js";
import type { AppDeps } from "../../../src/application/deps.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";

async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  return { deps: { db: handle.db, config }, handle };
}

test("soft delete sets deletedAt", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    await executeSoftDeleteSeller(deps, sellerId);

    const [row] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    assert.ok(row?.deletedAt);
  } finally {
    await handle.close();
  }
});

test("soft delete on already-deleted seller is a no-op", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    await executeSoftDeleteSeller(deps, sellerId);
    const [first] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    const firstDeletedAt = first?.deletedAt;

    await executeSoftDeleteSeller(deps, sellerId);

    const [second] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    assert.equal(second?.deletedAt?.getTime(), firstDeletedAt?.getTime());
  } finally {
    await handle.close();
  }
});
