import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeListSellers } from "../../../src/application/seller/queries/listSellersQuery.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers } from "../../../src/db/schema.runtime.js";
import { SELLER_ERROR_CODES, SellerError } from "../../../src/domain/seller/errors.js";
import type { AppDeps } from "../../../src/application/deps.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";

async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  return { deps: { db: handle.db, config }, handle };
}

test("admin lists all sellers", async () => {
  const { deps, handle } = await createTestContext();
  try {
    await insertAccount(deps);
    await insertAccount(deps);

    const list = await executeListSellers(deps, { actor: { role: "admin" } });
    assert.equal(list.length, 2);
  } finally {
    await handle.close();
  }
});

test("admin filters by status", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId: s1 } = await insertAccount(deps);
    const { sellerId: s2 } = await insertAccount(deps);
    assert.ok(s1 && s2);
    await deps.db
      .update(sellers)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(sellers.id, s1));

    const list = await executeListSellers(deps, { actor: { role: "admin" }, status: "active" });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.id, s1);
  } finally {
    await handle.close();
  }
});

test("risk_analyst gets in_review only", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId: s1 } = await insertAccount(deps);
    const { sellerId: s2 } = await insertAccount(deps);
    assert.ok(s1 && s2);
    await deps.db
      .update(sellers)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(sellers.id, s1));

    const list = await executeListSellers(deps, {
      actor: { role: "risk_analyst" },
      status: "active",
    });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.id, s1);
    assert.equal(list[0]!.status, "in_review");
  } finally {
    await handle.close();
  }
});

test("seller role cannot list sellers", async () => {
  const { deps, handle } = await createTestContext();
  try {
    await insertAccount(deps);

    await assert.rejects(
      () => executeListSellers(deps, { actor: { role: "seller" } }),
      (e: unknown) => {
        assert.ok(e instanceof SellerError);
        assert.equal(e.code, SELLER_ERROR_CODES.FORBIDDEN);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("soft-deleted sellers excluded from list", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    const list = await executeListSellers(deps, { actor: { role: "admin" } });
    assert.equal(list.length, 0);
  } finally {
    await handle.close();
  }
});
