/**
 * Dev seed: account + seller for local login smoke tests.
 * Run: `npm run seed:dev` (requires DATABASE_URL; uses same DB as the API).
 * On SQLite it applies pending migrations first, so it works on an empty `data/dupply.db`.
 *
 * Default seller credentials:
 *   email: seller@dupply.dev.local
 *   password: dev-password-change-me
 */
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import argon2 from "argon2";

import { loadConfig } from "../src/infra/env/config.js";
import { createDb, runMigrations } from "../src/infra/database/index.js";
import { runTransaction } from "../src/infra/database/transaction.js";
import { accounts, sellers, investors, payers, receivables } from "../src/infra/database/schema.runtime.js";
import {
  EMPTY_BUSINESS_RELATIONS_METADATA,
  EMPTY_COMPANY_METADATA,
  EMPTY_LEGAL_REP_METADATA,
} from "../src/modules/seller/domain/types.js";

const DEV_PASSWORD = "dev-password-change-me";

const DEV_SELLER = {
  email: "seller@dupply.dev.local",
  name: "Dev Seller",
};

const DEV_INVESTOR = {
  email: "investor@dupply.dev.local",
  name: "Dev Investor",
};

async function main(): Promise<void> {
  const config = loadConfig();
  const dbHandle = createDb(config.DATABASE_URL);
  // SQLite: apply drizzle/ migrations so the seed works on an empty file without starting
  // the API first. No-op on Postgres (use `npm run db:push` there).
  await runMigrations(dbHandle);
  const { db } = dbHandle;
  const passwordHash = await argon2.hash(DEV_PASSWORD);
  const now = new Date();

  // 1. Seed Seller
  const [existingSeller] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, DEV_SELLER.email))
    .limit(1);

  if (!existingSeller) {
    const accountId = createId();
    const sellerId = createId();

    await runTransaction(db, config.DATABASE_URL, (tx, exec) => {
      exec(
        tx.insert(accounts).values({
          id: accountId,
          email: DEV_SELLER.email,
          passwordHash,
          role: "seller",
          status: "active",
          createdAt: now,
          updatedAt: now,
        }),
      );

      exec(
        tx.insert(sellers).values({
          id: sellerId,
          name: DEV_SELLER.name,
          status: "active",
          accountId,
          companyMetaData: EMPTY_COMPANY_METADATA,
          legalRepresentativeMetaData: EMPTY_LEGAL_REP_METADATA,
          businessRelationsMetaData: EMPTY_BUSINESS_RELATIONS_METADATA,
          createdAt: now,
          updatedAt: now,
        }),
      );
    });

    console.log(`created account: ${DEV_SELLER.email} (role=seller)`);
    console.log(`created seller: ${DEV_SELLER.name} id=${sellerId} status=active`);
  } else {
    console.log(`skip (exists): ${DEV_SELLER.email}`);
  }

  // 2. Seed Investor
  const [existingInvestor] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, DEV_INVESTOR.email))
    .limit(1);

  if (!existingInvestor) {
    const accountId = createId();
    const investorId = createId();

    await runTransaction(db, config.DATABASE_URL, (tx, exec) => {
      exec(
        tx.insert(accounts).values({
          id: accountId,
          email: DEV_INVESTOR.email,
          passwordHash,
          role: "investor",
          status: "active",
          createdAt: now,
          updatedAt: now,
        }),
      );

      exec(
        tx.insert(investors).values({
          id: investorId,
          name: DEV_INVESTOR.name,
          accountId,
          balanceCents: 100000000,
          createdAt: now,
          updatedAt: now,
        }),
      );
    });

    console.log(`created account: ${DEV_INVESTOR.email} (role=investor)`);
    console.log(`created investor: ${DEV_INVESTOR.name} id=${investorId} with R$ 1,000,000.00 balance`);
  } else {
    console.log(`skip (exists): ${DEV_INVESTOR.email}`);
    const [inv] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.email, DEV_INVESTOR.email))
      .limit(1);
    if (inv) {
      await db.update(investors)
        .set({ balanceCents: 100000000 })
        .where(eq(investors.accountId, inv.id));
      console.log(`Forced investor balance to R$ 1,000,000.00`);
    }
  }

  // 2b. Seed Analyst & Admin
  const analystEmail = "analyst@dupply.dev.local";
  const [existingAnalyst] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, analystEmail))
    .limit(1);

  if (!existingAnalyst) {
    await db.insert(accounts).values({
      id: createId(),
      email: analystEmail,
      passwordHash,
      role: "risk_analyst",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    console.log(`created account: ${analystEmail} (role=risk_analyst)`);
  }

  const adminEmail = "admin@dupply.dev.local";
  const [existingAdmin] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, adminEmail))
    .limit(1);

  if (!existingAdmin) {
    await db.insert(accounts).values({
      id: createId(),
      email: adminEmail,
      passwordHash,
      role: "admin",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    console.log(`created account: ${adminEmail} (role=admin)`);
  }

  // 3. Seed some Receivables in funding status so the investor has opportunities
  const [sellerRow] = await db
    .select()
    .from(sellers)
    .where(eq(sellers.name, DEV_SELLER.name))
    .limit(1);

  if (sellerRow) {
    // Clear existing receivables for seller on seed run
    await db.delete(receivables).where(eq(receivables.sellerId, sellerRow.id));
    // Clear existing payers to avoid UNIQUE constraint failures
    await db.delete(payers).where(eq(payers.cnpj, "12345678000199"));
    await db.delete(payers).where(eq(payers.cnpj, "98765432000188"));

    const payerId1 = createId();
    const payerId2 = createId();
    const recId1 = createId();
    const recId2 = createId();

    await runTransaction(db, config.DATABASE_URL, (tx, exec) => {
      exec(
        tx.insert(payers).values({
          id: payerId1,
          legalName: "Payer Alpha S.A.",
          email: "financial@alpha.com",
          cnpj: "12345678000199",
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
      );
      exec(
        tx.insert(payers).values({
          id: payerId2,
          legalName: "Payer Beta S.A.",
          email: "financial@beta.com",
          cnpj: "98765432000188",
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
      );

      exec(
        tx.insert(receivables).values({
          id: recId1,
          status: "funding",
          sellerId: sellerRow.id,
          payerId: payerId1,
          value: "25000000",
          targetFundingCents: 25000000, // R$ 250.000,00
          fundedCents: 5000000, // R$ 50.000,00 already funded
          yieldRateAnnual: 0.18, // 18%
          createdAt: now,
          updatedAt: now,
        })
      );

      exec(
        tx.insert(receivables).values({
          id: recId2,
          status: "funding",
          sellerId: sellerRow.id,
          payerId: payerId2,
          value: "45000000",
          targetFundingCents: 45000000, // R$ 450.000,00
          fundedCents: 0,
          yieldRateAnnual: 0.22, // 22%
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    console.log("Seeded 2 mock receivables in 'funding' status.");
  }

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
