import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeGetSellerWallet } from "../../../src/application/wallet/queries/getSellerWalletQuery.js";
import { executeRegisterSellerWallet } from "../../../src/application/wallet/commands/registerSellerWalletCommand.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers } from "../../../src/db/schema.runtime.js";
import { WALLET_ERROR_CODES, WalletError } from "../../../src/domain/wallet/errors.js";
import { SELLER_ERROR_CODES, SellerError } from "../../../src/domain/seller/errors.js";
import type { AppDeps } from "../../../src/application/deps.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";
import { validRegisterWalletPayload } from "../../helpers/walletTestHelpers.js";

async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  return { deps: { db: handle.db, config }, handle };
}

async function registerWalletForSeller(deps: AppDeps, sellerId: string): Promise<string> {
  await deps.db
    .update(sellers)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(sellers.id, sellerId));

  const view = await executeRegisterSellerWallet(deps, {
    actor: { profileId: sellerId, role: "seller" },
    sellerId,
    payload: validRegisterWalletPayload(),
  });
  return view.id;
}

test("seller GET own wallet succeeds", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const walletId = await registerWalletForSeller(deps, sellerId);

    const view = await executeGetSellerWallet(deps, {
      actor: { sub: "acc", role: "seller", profileId: sellerId },
      sellerId,
    });

    assert.equal(view.id, walletId);
    assert.ok(!("secretEncrypted" in view));
  } finally {
    await handle.close();
  }
});

test("admin GET any seller wallet succeeds", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const walletId = await registerWalletForSeller(deps, sellerId);

    const view = await executeGetSellerWallet(deps, {
      actor: { sub: "admin-acc", role: "admin", profileId: "placeholder" },
      sellerId,
    });

    assert.equal(view.id, walletId);
  } finally {
    await handle.close();
  }
});

test("seller with walletId null returns wallet_not_found", async () => {
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
        executeGetSellerWallet(deps, {
          actor: { sub: "acc", role: "seller", profileId: sellerId },
          sellerId,
        }),
      (e: unknown) => {
        assert.ok(e instanceof WalletError);
        assert.equal(e.code, WALLET_ERROR_CODES.NOT_FOUND);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("different seller cannot read wallet via seller query", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const first = await insertAccount(deps);
    const second = await insertAccount(deps);
    assert.ok(first.sellerId);
    assert.ok(second.sellerId);
    await registerWalletForSeller(deps, first.sellerId);

    await assert.rejects(
      () =>
        executeGetSellerWallet(deps, {
          actor: { sub: "acc-2", role: "seller", profileId: second.sellerId! },
          sellerId: first.sellerId!,
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
