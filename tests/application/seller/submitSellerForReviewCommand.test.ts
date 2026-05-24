import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeSubmitSellerForReview } from "../../../src/application/seller/commands/submitSellerForReviewCommand.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers } from "../../../src/db/schema.runtime.js";
import { SELLER_ERROR_CODES, SellerError } from "../../../src/domain/seller/errors.js";
import type { AppDeps } from "../../../src/application/deps.js";
import {
  completeBusinessRelationsMetaData,
  completeCompanyMetaData,
  completeLegalRepMetaData,
  insertAccount,
} from "../../helpers/sellerTestHelpers.js";
import { executeUpdateSellerMetadata } from "../../../src/application/seller/commands/updateSellerMetadataCommand.js";

async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  return { deps: { db: handle.db, config }, handle };
}

test("executeSubmitSellerForReview transitions to in_review with complete metadata", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    await executeUpdateSellerMetadata(deps, { profileId: sellerId }, sellerId, {
      companyMetaData: completeCompanyMetaData,
      legalRepresentativeMetaData: completeLegalRepMetaData,
      businessRelationsMetaData: completeBusinessRelationsMetaData,
    });

    await executeSubmitSellerForReview(deps, { profileId: sellerId }, sellerId);

    const [row] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    assert.equal(row?.status, "in_review");
  } finally {
    await handle.close();
  }
});

test("executeSubmitSellerForReview rejects incomplete metadata", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    await assert.rejects(
      () => executeSubmitSellerForReview(deps, { profileId: sellerId }, sellerId),
      (e: unknown) => {
        assert.ok(e instanceof SellerError);
        assert.equal(e.code, SELLER_ERROR_CODES.INCOMPLETE_METADATA);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("executeSubmitSellerForReview rejects when not owner", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    await assert.rejects(
      () => executeSubmitSellerForReview(deps, { profileId: "other" }, sellerId),
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

test("executeSubmitSellerForReview rejects when already in_review", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    await assert.rejects(
      () => executeSubmitSellerForReview(deps, { profileId: sellerId }, sellerId),
      (e: unknown) => {
        assert.ok(e instanceof SellerError);
        assert.equal(e.code, SELLER_ERROR_CODES.INVALID_STATUS_FOR_SUBMIT);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});
