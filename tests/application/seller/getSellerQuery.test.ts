import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeGetSeller } from "../../../src/application/seller/queries/getSellerQuery.js";
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

test("seller reads own profile", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    const view = await executeGetSeller(deps, {
      actor: { sub: id, role: "seller", profileId: sellerId },
      sellerId,
    });
    assert.equal(view.id, sellerId);
  } finally {
    await handle.close();
  }
});

test("admin reads any seller", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    const view = await executeGetSeller(deps, {
      actor: { sub: "admin-1", role: "admin", profileId: "placeholder" },
      sellerId,
    });
    assert.equal(view.id, sellerId);
  } finally {
    await handle.close();
  }
});

test("risk_analyst reads in_review seller", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    const view = await executeGetSeller(deps, {
      actor: { sub: "ra-1", role: "risk_analyst", profileId: "placeholder" },
      sellerId,
    });
    assert.equal(view.status, "in_review");
  } finally {
    await handle.close();
  }
});

test("risk_analyst blocked on active seller", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    await assert.rejects(
      () =>
        executeGetSeller(deps, {
          actor: { sub: "ra-1", role: "risk_analyst", profileId: "placeholder" },
          sellerId,
        }),
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

test("soft-deleted seller returns not_found", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    await assert.rejects(
      () =>
        executeGetSeller(deps, {
          actor: { sub: id, role: "seller", profileId: sellerId },
          sellerId,
        }),
      (e: unknown) => {
        assert.ok(e instanceof SellerError);
        assert.equal(e.code, SELLER_ERROR_CODES.NOT_FOUND);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
