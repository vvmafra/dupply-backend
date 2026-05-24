import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeTransitionSellerStatus } from "../../../src/application/seller/commands/transitionSellerStatusCommand.js";
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

async function setSellerStatus(deps: AppDeps, sellerId: string, status: string): Promise<void> {
  await deps.db
    .update(sellers)
    .set({ status, updatedAt: new Date() })
    .where(eq(sellers.id, sellerId));
}

test("admin can approve in_review → active", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await setSellerStatus(deps, sellerId, "in_review");

    await executeTransitionSellerStatus(deps, {
      sellerId,
      targetStatus: "active",
      actor: { role: "admin" },
    });

    const [row] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    assert.equal(row?.status, "active");
    assert.equal(row?.walletId, null);
  } finally {
    await handle.close();
  }
});

test("admin can reject in_review → inactive", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await setSellerStatus(deps, sellerId, "in_review");

    await executeTransitionSellerStatus(deps, {
      sellerId,
      targetStatus: "inactive",
      actor: { role: "admin" },
    });

    const [row] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    assert.equal(row?.status, "inactive");
  } finally {
    await handle.close();
  }
});

test("admin can deactivate active → inactive", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await setSellerStatus(deps, sellerId, "active");

    await executeTransitionSellerStatus(deps, {
      sellerId,
      targetStatus: "inactive",
      actor: { role: "admin" },
    });

    const [row] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    assert.equal(row?.status, "inactive");
  } finally {
    await handle.close();
  }
});

test("admin can reactivate inactive → active", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await setSellerStatus(deps, sellerId, "inactive");

    await executeTransitionSellerStatus(deps, {
      sellerId,
      targetStatus: "active",
      actor: { role: "admin" },
    });

    const [row] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    assert.equal(row?.status, "active");
  } finally {
    await handle.close();
  }
});

test("created → active throws invalid_status_transition", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    await assert.rejects(
      () =>
        executeTransitionSellerStatus(deps, {
          sellerId,
          targetStatus: "active",
          actor: { role: "admin" },
        }),
      (e: unknown) => {
        assert.ok(e instanceof SellerError);
        assert.equal(e.code, SELLER_ERROR_CODES.INVALID_STATUS_TRANSITION);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
