/**
 * Dev seed: account + seller for local login smoke tests.
 * Run: `npm run seed:dev` (requires DATABASE_URL; uses same DB as the API).
 *
 * Default seller credentials:
 *   email: seller@dupply.dev.local
 *   password: dev-password-change-me
 */
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import argon2 from "argon2";

import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db/index.js";
import { accounts, sellers } from "../src/db/schema.runtime.js";
import {
  EMPTY_BUSINESS_RELATIONS_METADATA,
  EMPTY_COMPANY_METADATA,
  EMPTY_LEGAL_REP_METADATA,
} from "../src/domain/seller/types.js";

const DEV_PASSWORD = "dev-password-change-me";

const DEV_SELLER = {
  email: "seller@dupply.dev.local",
  name: "Dev Seller",
};

async function main(): Promise<void> {
  const config = loadConfig();
  const dbHandle = createDb(config.DATABASE_URL);
  const { db } = dbHandle;
  const passwordHash = await argon2.hash(DEV_PASSWORD);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, DEV_SELLER.email))
    .limit(1);

  if (existing) {
    console.log(`skip (exists): ${DEV_SELLER.email}`);
    await dbHandle.close();
    return;
  }

  const accountId = createId();
  const sellerId = createId();

  await db.transaction(async (tx) => {
    await tx.insert(accounts).values({
      id: accountId,
      email: DEV_SELLER.email,
      passwordHash,
      role: "seller",
      status: "active",
      refreshToken: null,
      refreshTokenLookup: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await tx.insert(sellers).values({
      id: sellerId,
      name: DEV_SELLER.name,
      status: "active",
      accountId,
      companyMetaData: EMPTY_COMPANY_METADATA,
      legalRepresentativeMetaData: EMPTY_LEGAL_REP_METADATA,
      businessRelationsMetaData: EMPTY_BUSINESS_RELATIONS_METADATA,
      walletId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  });

  console.log(`created account: ${DEV_SELLER.email} (role=seller)`);
  console.log(`created seller: ${DEV_SELLER.name} id=${sellerId} status=active`);
  console.log(`password: ${DEV_PASSWORD}`);
  console.log("\nLogin: POST /v1/auth/login with email + password above.");

  await dbHandle.close();
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
