import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeGetWalletById } from "../../../src/application/wallet/queries/getWalletByIdQuery.js";
import { executeRegisterSellerWallet } from "../../../src/application/wallet/commands/registerSellerWalletCommand.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers } from "../../../src/db/schema.runtime.js";
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

test("seller GET own wallet by id succeeds", async () => {
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

    const view = await executeGetWalletById(deps, {
      actor: { profileId: sellerId, role: "seller" },
      walletId: registered.id,
    });

    assert.equal(view.id, registered.id);
    assert.ok(!("secretEncrypted" in view));
  } finally {
    await handle.close();
  }
});

test("admin GET wallet by id succeeds", async () => {
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

    const view = await executeGetWalletById(deps, {
      actor: { profileId: "placeholder", role: "admin" },
      walletId: registered.id,
    });

    assert.equal(view.id, registered.id);
  } finally {
    await handle.close();
  }
});

test("different seller cannot read wallet by id", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const first = await insertAccount(deps);
    const second = await insertAccount(deps);
    assert.ok(first.sellerId);
    assert.ok(second.sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(sellers.id, first.sellerId));

    const registered = await executeRegisterSellerWallet(deps, {
      actor: { profileId: first.sellerId, role: "seller" },
      sellerId: first.sellerId,
      payload: validRegisterWalletPayload(),
    });

    await assert.rejects(
      () =>
        executeGetWalletById(deps, {
          actor: { profileId: second.sellerId!, role: "seller" },
          walletId: registered.id,
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
