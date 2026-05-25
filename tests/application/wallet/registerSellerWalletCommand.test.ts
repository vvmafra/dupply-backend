import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeRegisterSellerWallet } from "../../../src/application/wallet/commands/registerSellerWalletCommand.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers, wallets } from "../../../src/db/schema.runtime.js";
import { WALLET_ERROR_CODES, WalletError } from "../../../src/domain/wallet/errors.js";
import type { AppDeps } from "../../../src/application/deps.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";
import { validRegisterWalletPayload, VALID_CONTRACT_ID_ALT } from "../../helpers/walletTestHelpers.js";

async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  return { deps: { db: handle.db, config }, handle };
}

async function activateSeller(deps: AppDeps, sellerId: string): Promise<void> {
  await deps.db
    .update(sellers)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(sellers.id, sellerId));
}

test("active seller with walletId null registers wallet and updates seller.walletId", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await activateSeller(deps, sellerId);

    const view = await executeRegisterSellerWallet(deps, {
      actor: { profileId: sellerId, role: "seller" },
      sellerId,
      payload: validRegisterWalletPayload(),
    });

    assert.equal(view.type, "smart_account");
    assert.equal(view.parentType, "seller");
    assert.equal(view.sellerId, sellerId);
    assert.equal(view.network, "testnet");
    assert.ok(!("secretEncrypted" in view));

    const [sellerRow] = await deps.db
      .select()
      .from(sellers)
      .where(eq(sellers.id, sellerId))
      .limit(1);
    assert.equal(sellerRow?.walletId, view.id);

    const [walletRow] = await deps.db
      .select()
      .from(wallets)
      .where(eq(wallets.id, view.id))
      .limit(1);
    assert.equal(walletRow?.secretEncrypted, null);
  } finally {
    await handle.close();
  }
});

test("second registration for same seller/network throws wallet_already_exists", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await activateSeller(deps, sellerId);

    await executeRegisterSellerWallet(deps, {
      actor: { profileId: sellerId, role: "seller" },
      sellerId,
      payload: validRegisterWalletPayload(),
    });

    await assert.rejects(
      () =>
        executeRegisterSellerWallet(deps, {
          actor: { profileId: sellerId, role: "seller" },
          sellerId,
          payload: validRegisterWalletPayload({ contractId: VALID_CONTRACT_ID_ALT }),
        }),
      (e: unknown) => {
        assert.ok(e instanceof WalletError);
        assert.equal(e.code, WALLET_ERROR_CODES.WALLET_ALREADY_EXISTS);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("non-active seller cannot register wallet", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    await assert.rejects(
      () =>
        executeRegisterSellerWallet(deps, {
          actor: { profileId: sellerId, role: "seller" },
          sellerId,
          payload: validRegisterWalletPayload(),
        }),
      (e: unknown) => {
        assert.ok(e instanceof WalletError);
        assert.equal(e.code, WALLET_ERROR_CODES.SELLER_NOT_ACTIVE);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("seller cannot register wallet for another seller profile", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const first = await insertAccount(deps);
    const second = await insertAccount(deps);
    assert.ok(first.sellerId);
    assert.ok(second.sellerId);
    await activateSeller(deps, first.sellerId);

    await assert.rejects(
      () =>
        executeRegisterSellerWallet(deps, {
          actor: { profileId: second.sellerId!, role: "seller" },
          sellerId: first.sellerId!,
          payload: validRegisterWalletPayload(),
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
