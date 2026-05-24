import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { executeUpdateSellerMetadata } from "../../../src/application/seller/commands/updateSellerMetadataCommand.js";
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

async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  return { deps: { db: handle.db, config }, handle };
}

test("executeUpdateSellerMetadata succeeds while status is created", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    const view = await executeUpdateSellerMetadata(
      deps,
      { profileId: sellerId },
      sellerId,
      {
        name: "Nova Empresa",
        companyMetaData: { legalName: "Empresa Teste LTDA", cnpj: "12345678000195" },
      },
    );

    assert.equal(view.name, "Nova Empresa");
    assert.equal(view.companyMetaData.legalName, "Empresa Teste LTDA");
  } finally {
    await handle.close();
  }
});

test("executeUpdateSellerMetadata rejects in_review status", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    await assert.rejects(
      () =>
        executeUpdateSellerMetadata(
          deps,
          { profileId: sellerId },
          sellerId,
          { name: "X" },
        ),
      (e: unknown) => {
        assert.ok(e instanceof SellerError);
        assert.equal(e.code, SELLER_ERROR_CODES.METADATA_LOCKED);
        return true;
      },
    );
  } finally {
    await handle.close();
  }
});

test("executeUpdateSellerMetadata converts money to cents in storage", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    const view = await executeUpdateSellerMetadata(
      deps,
      { profileId: sellerId },
      sellerId,
      { companyMetaData: { shareCapital: 150000.0, annualRevenue: 5000000.0 } },
    );

    assert.equal(view.companyMetaData.shareCapital, 150000);
    assert.equal(view.companyMetaData.annualRevenue, 5000000);

    const [row] = await deps.db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1);
    const stored = JSON.parse(row!.companyMetaData) as { shareCapital: number; annualRevenue: number };
    assert.equal(stored.shareCapital, 15000000);
    assert.equal(stored.annualRevenue, 500000000);
  } finally {
    await handle.close();
  }
});

test("executeUpdateSellerMetadata rejects wrong profileId", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    await assert.rejects(
      () =>
        executeUpdateSellerMetadata(
          deps,
          { profileId: "other-seller" },
          sellerId,
          { name: "X" },
        ),
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

test("executeUpdateSellerMetadata preserves untouched fields on partial merge", async () => {
  const { deps, handle } = await createTestContext();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);

    await executeUpdateSellerMetadata(deps, { profileId: sellerId }, sellerId, {
      companyMetaData: completeCompanyMetaData,
      legalRepresentativeMetaData: completeLegalRepMetaData,
      businessRelationsMetaData: completeBusinessRelationsMetaData,
    });

    const view = await executeUpdateSellerMetadata(deps, { profileId: sellerId }, sellerId, {
      companyMetaData: { phone: "41988776655" },
    });

    assert.equal(view.companyMetaData.phone, "41988776655");
    assert.equal(view.companyMetaData.legalName, completeCompanyMetaData.legalName);
    assert.equal(view.legalRepresentativeMetaData.fullName, completeLegalRepMetaData.fullName);
  } finally {
    await handle.close();
  }
});
