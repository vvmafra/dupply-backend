import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeUpdateWalletStatus } from "../../../src/application/wallet/commands/updateWalletStatusCommand.js";
import { executeRegisterSellerWallet } from "../../../src/application/wallet/commands/registerSellerWalletCommand.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers, wallets } from "../../../src/db/schema.runtime.js";
import { WALLET_ERROR_CODES, WalletError } from "../../../src/domain/wallet/errors.js";
import type { AppDeps } from "../../../src/application/deps.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";
import { validRegisterWalletPayload } from "../../helpers/walletTestHelpers.js";

async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  return { deps: { db: handle.db, config }, handle };
}

test("admin can deactivate and reactivate wallet", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    const registered = await executeRegisterSellerWallet(deps, {
      actor: { profileId: sellerId, role: "seller" },
      sellerId,
      payload: validRegisterWalletPayload(),
    });

    const inactive = await executeUpdateWalletStatus(deps, {
      walletId: registered.id,
      status: "inactive",
      actor: { role: "admin" },
    });
    assert.equal(inactive.status, "inactive");

    const active = await executeUpdateWalletStatus(deps, {
      walletId: registered.id,
      status: "active",
      actor: { role: "admin" },
    });
    assert.equal(active.status, "active");

    const [row] = await deps.db
      .select()
      .from(wallets)
      .where(eq(wallets.id, registered.id))
      .limit(1);
    assert.equal(row?.status, "active");
  } finally {
    await handle.close();
  }
});

test("seller cannot update wallet status", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    const registered = await executeRegisterSellerWallet(deps, {
      actor: { profileId: sellerId, role: "seller" },
      sellerId,
      payload: validRegisterWalletPayload(),
    });

    await assert.rejects(
      () =>
        executeUpdateWalletStatus(deps, {
          walletId: registered.id,
          status: "inactive",
          actor: { role: "seller" },
        }),
      (e: unknown) => {
        assert.ok(e instanceof WalletError);
        assert.equal(e.code, WALLET_ERROR_CODES.FORBIDDEN);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
