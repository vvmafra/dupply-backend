import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeCreateReceivable } from "../../../src/application/receivable/commands/receivableCommands.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers } from "../../../src/db/schema.runtime.js";
import { SellerError, SELLER_ERROR_CODES } from "../../../src/domain/seller/errors.js";
import type { AppDeps } from "../../../src/application/deps.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";

async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  return { deps: { db: handle.db, config }, handle };
}

const payerUserId = randomUUID();

test("active seller can create receivable", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id: accountId, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    const result = await executeCreateReceivable(deps, {
      sellerUserId: accountId,
      payerUserId,
      value: "1000.00",
    });
    assert.ok(result.id);
  } finally {
    await handle.close();
  }
});

test("created seller cannot create receivable", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id: accountId } = await insertAccount(deps);

    await assert.rejects(
      () =>
        executeCreateReceivable(deps, {
          sellerUserId: accountId,
          payerUserId,
          value: "1000.00",
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

test("in_review seller cannot create receivable", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id: accountId, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    await assert.rejects(
      () =>
        executeCreateReceivable(deps, {
          sellerUserId: accountId,
          payerUserId,
          value: "1000.00",
        }),
      SellerError,
    );
  } finally {
    await handle.close();
  }
});

test("inactive seller cannot create receivable", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id: accountId, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    await assert.rejects(
      () =>
        executeCreateReceivable(deps, {
          sellerUserId: accountId,
          payerUserId,
          value: "1000.00",
        }),
      SellerError,
    );
  } finally {
    await handle.close();
  }
});

test("soft-deleted seller cannot create receivable", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { id: accountId, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "active", deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    await assert.rejects(
      () =>
        executeCreateReceivable(deps, {
          sellerUserId: accountId,
          payerUserId,
          value: "1000.00",
        }),
      (e: unknown) => {
        assert.ok(e instanceof Error);
        assert.equal(e.message, "invalid_seller");
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
