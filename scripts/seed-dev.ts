/**
 * Demo seed: resets the demo accounts to a known state and creates one receivable per
 * lifecycle stage, an investor with an active portfolio, a seller pending review, and an
 * AI report on every reviewed receivable. Safe to re-run: demo data is wiped and recreated,
 * accounts and passwords are kept.
 *
 * Run: `npm run seed:dev` (uses DATABASE_URL; SQLite migrations are applied first).
 *
 * Logins (password `dev-password-change-me`):
 *   seller@dupply.dev.local          active seller with the demo receivables
 *   seller.review@dupply.dev.local   seller waiting for admin approval (in_review)
 *   investor@dupply.dev.local        investor, R$ 1.000.000,00 available + active investments
 *   analyst@dupply.dev.local         risk analyst
 *   admin@dupply.dev.local           admin
 */
import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";
import argon2 from "argon2";

import { loadConfig } from "../src/infra/env/config.js";
import { createDb, runMigrations } from "../src/infra/database/index.js";
import {
  accounts,
  investorDeposits,
  investorInvestments,
  investorWithdrawals,
  investors,
  payers,
  receivables,
  sellers,
} from "../src/infra/database/schema.runtime.js";
import type { AppDeps } from "../src/compose/deps.js";
import { prepareReceivableMetaDataForWrite } from "../src/modules/receivable/application/receivableHelpers.js";
import type { ReceivableStatus } from "../src/modules/receivable/domain/transitions.js";
import { computeSimpleInterestCents } from "../src/modules/settlement/domain/yield.js";
import { toCents } from "../src/shared/money.js";
import {
  buildDemoAiReport,
  DEMO_INVESTOR,
  DEMO_PASSWORD,
  DEMO_PAYERS,
  DEMO_RECEIVABLES,
  DEMO_SELLERS,
  DEMO_STAFF,
  STATUS_TIMELINES,
  type DemoReceivableFixture,
} from "./seed/demo-fixtures.js";

type Db = AppDeps["db"];
type AccountRole = "seller" | "investor" | "risk_analyst" | "admin";

const DAY_MS = 86_400_000;
const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const FUNDED_OR_LATER: ReceivableStatus[] = [
  "funding", "funded", "processing", "completed", "payer_settled", "overdue",
];

async function upsertAccount(
  db: Db,
  email: string,
  role: AccountRole,
  passwordHash: string,
  now: Date,
): Promise<{ id: string; created: boolean }> {
  const [existing] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  if (existing) return { id: existing.id, created: false };
  const id = createId();
  await db.insert(accounts).values({
    id, email, passwordHash, role, status: "active", createdAt: now, updatedAt: now,
  });
  return { id, created: true };
}

/** Returns the seller id; metadata and status are reset on every run. */
async function upsertSeller(
  db: Db,
  fixture: (typeof DEMO_SELLERS)[number],
  accountId: string,
  now: Date,
): Promise<string> {
  const values = {
    name: fixture.name,
    status: fixture.status,
    companyMetaData: JSON.stringify(fixture.company),
    legalRepresentativeMetaData: JSON.stringify(fixture.legalRepresentative),
    businessRelationsMetaData: JSON.stringify(fixture.businessRelations),
    updatedAt: now,
  };
  const [existing] = await db.select().from(sellers).where(eq(sellers.accountId, accountId)).limit(1);
  if (existing) {
    await db.update(sellers).set(values).where(eq(sellers.id, existing.id));
    return existing.id;
  }
  const id = createId();
  await db.insert(sellers).values({ id, accountId, createdAt: now, ...values });
  return id;
}

async function upsertInvestor(db: Db, accountId: string, now: Date): Promise<string> {
  const [existing] = await db.select().from(investors).where(eq(investors.accountId, accountId)).limit(1);
  if (existing) return existing.id;
  const id = createId();
  await db.insert(investors).values({
    id, name: DEMO_INVESTOR.name, accountId, balanceCents: 0, createdAt: now, updatedAt: now,
  });
  return id;
}

/** Wipes receivables of the demo sellers, the demo investor's ledger and the demo payers. */
async function wipeDemoData(db: Db, sellerIds: string[], investorId: string): Promise<void> {
  // Per-row deletes: the runtime `Db` is a SQLite | Postgres union, and `inArray` on
  // receivable columns does not type-check across both dialects.
  for (const sellerId of sellerIds) {
    const owned = await db.select().from(receivables).where(eq(receivables.sellerId, sellerId));
    for (const r of owned) {
      await db.delete(investorInvestments).where(eq(investorInvestments.receivableId, r.id));
      await db.delete(receivables).where(eq(receivables.id, r.id));
    }
  }
  await db.delete(investorInvestments).where(eq(investorInvestments.investorId, investorId));
  await db.delete(investorDeposits).where(eq(investorDeposits.investorId, investorId));
  await db.delete(investorWithdrawals).where(eq(investorWithdrawals.investorId, investorId));
  await db.delete(payers).where(inArray(payers.cnpj, DEMO_PAYERS.map((p) => p.cnpj)));
}

/** Evenly spaces the timeline between `createdAt` and now. */
function buildStatusHistory(timeline: ReceivableStatus[], createdAt: Date, now: Date) {
  const span = now.getTime() - createdAt.getTime();
  const step = timeline.length > 1 ? span / timeline.length : 0;
  const history: Record<string, string> = {};
  timeline.forEach((status, i) => {
    history[status] = new Date(createdAt.getTime() + step * i).toISOString();
  });
  return history;
}

type SeededReceivable = { key: string; id: string; status: ReceivableStatus };

async function seedReceivable(
  db: Db,
  fx: DemoReceivableFixture,
  ctx: { sellerId: string; investorId: string; payerIds: Map<string, string>; now: Date },
  company: (typeof DEMO_SELLERS)[number]["company"],
): Promise<{ seeded: SeededReceivable; activeCents: number; settledPayoutCents: number }> {
  const { now } = ctx;
  const payer = DEMO_PAYERS.find((p) => p.cnpj === fx.payerCnpj)!;
  const payerId = ctx.payerIds.get(fx.payerCnpj)!;
  const createdAt = daysAgo(now, fx.ageDays);
  const timeline = STATUS_TIMELINES[fx.status];
  const history = buildStatusHistory(timeline, createdAt, now);
  const dueDate = new Date(now.getTime() + fx.dueInDays * DAY_MS);

  const { receivableMetaData, materializedKeys } = prepareReceivableMetaDataForWrite({
    ...fx.meta,
    issuedAt: isoDate(createdAt),
    dueDate: isoDate(dueDate),
    payerCnpj: payer.cnpj,
    payerLegalName: payer.legalName,
    payerFinancialEmail: payer.email,
    fiscalDocumentKey: `3526${payer.cnpj}55001000000${fx.meta.billNumber.slice(-4)}1${fx.ageDays.toString().padStart(3, "0")}`,
    payerAcceptanceStatus: "accepted",
    desiredAnticipationValue: fx.proposedValueReais ?? fx.valueReais,
    antifraudDeclarationsAccepted: true,
  });

  const proposedCents = fx.proposedValueReais === undefined ? null : toCents(fx.proposedValueReais);
  const opensFunding = FUNDED_OR_LATER.includes(fx.status);
  const targetFundingCents = opensFunding ? (proposedCents ?? toCents(fx.valueReais)) : 0;
  const fundedCents = fx.investment ? toCents(fx.investment.amountReais) : 0;

  const id = createId();
  await db.insert(receivables).values({
    id,
    status: fx.status,
    sellerId: ctx.sellerId,
    payerId,
    receivableMetaData,
    normalizedBillNumber: materializedKeys.normalizedBillNumber,
    normalizedFiscalDocumentKey: materializedKeys.normalizedFiscalDocumentKey,
    aiReport: fx.withAiReport ? JSON.stringify(buildDemoAiReport(company, payer)) : null,
    value: String(toCents(fx.valueReais)),
    proposedValue: proposedCents === null ? null : String(proposedCents),
    statusHistory: JSON.stringify(history),
    targetFundingCents,
    fundedCents,
    yieldRateMonthly: fx.yieldRateMonthly ?? 0,
    minInvestmentCents: fx.minInvestmentReais === undefined ? 0 : toCents(fx.minInvestmentReais),
    createdAt,
    updatedAt: new Date(history[fx.status]!),
  });

  let activeCents = 0;
  let settledPayoutCents = 0;
  if (fx.investment) {
    // The investment lands right after funding opened (partial) or at the `funded` instant.
    const investedAt = new Date(history.funded ?? history.funding!);
    const settled = fx.investment.status === "settled";
    const settledAt = settled ? new Date(history.payer_settled!) : investedAt;
    await db.insert(investorInvestments).values({
      id: createId(),
      investorId: ctx.investorId,
      receivableId: id,
      amountCents: fundedCents,
      idempotencyKey: `seed-${fx.key}`,
      status: fx.investment.status,
      createdAt: investedAt,
      updatedAt: settledAt,
    });
    if (settled) {
      const days = Math.max(1, Math.round((settledAt.getTime() - investedAt.getTime()) / DAY_MS));
      settledPayoutCents =
        fundedCents + computeSimpleInterestCents(fundedCents, fx.yieldRateMonthly ?? 0, days);
    } else {
      activeCents = fundedCents;
    }
  }

  return { seeded: { key: fx.key, id, status: fx.status }, activeCents, settledPayoutCents };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const dbHandle = createDb(config.DATABASE_URL);
  // SQLite: apply drizzle/ migrations so the seed works on an empty file. No-op on Postgres.
  await runMigrations(dbHandle);
  const { db } = dbHandle;
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const now = new Date();

  // 1. Accounts (kept across runs) and profiles (reset on every run)
  const sellerIds = new Map<string, string>();
  for (const fx of DEMO_SELLERS) {
    const account = await upsertAccount(db, fx.email, "seller", passwordHash, now);
    const sellerId = await upsertSeller(db, fx, account.id, now);
    sellerIds.set(fx.key, sellerId);
    console.log(`${account.created ? "created" : "reset  "} seller   ${fx.email} status=${fx.status}`);
  }
  const investorAccount = await upsertAccount(db, DEMO_INVESTOR.email, "investor", passwordHash, now);
  const investorId = await upsertInvestor(db, investorAccount.id, now);
  for (const staff of DEMO_STAFF) {
    const account = await upsertAccount(db, staff.email, staff.role, passwordHash, now);
    console.log(`${account.created ? "created" : "kept   "} ${staff.role.padEnd(8)} ${staff.email}`);
  }

  // 2. Wipe previous demo data, then payers
  await wipeDemoData(db, [...sellerIds.values()], investorId);
  const payerIds = new Map<string, string>();
  for (const p of DEMO_PAYERS) {
    const id = createId();
    await db.insert(payers).values({ id, ...p, createdAt: now, updatedAt: now });
    payerIds.set(p.cnpj, id);
  }

  // 3. One receivable per stage for the active seller, with the investor's positions
  const activeSeller = DEMO_SELLERS.find((s) => s.key === "seller")!;
  const ctx = { sellerId: sellerIds.get("seller")!, investorId, payerIds, now };
  const seeded: SeededReceivable[] = [];
  let activeCents = 0;
  let settledPayoutCents = 0;
  for (const fx of DEMO_RECEIVABLES) {
    const result = await seedReceivable(db, fx, ctx, activeSeller.company);
    seeded.push(result.seeded);
    activeCents += result.activeCents;
    settledPayoutCents += result.settledPayoutCents;
  }

  // 4. Investor ledger: one deposit that explains balance + active positions − settled payouts
  const balanceCents = toCents(DEMO_INVESTOR.balanceReais);
  const depositCents = balanceCents + activeCents - settledPayoutCents;
  const depositedAt = daysAgo(now, 90);
  await db.insert(investorDeposits).values({
    id: createId(),
    investorId,
    amountCents: depositCents,
    idempotencyKey: "seed-initial-deposit",
    externalTxId: "PIX-SEED-0001",
    status: "completed",
    createdAt: depositedAt,
    updatedAt: depositedAt,
  });
  await db.update(investors).set({ balanceCents, updatedAt: now }).where(eq(investors.id, investorId));

  // 5. Summary
  console.log("\nReceivables (seller@dupply.dev.local):");
  for (const r of seeded) console.log(`  ${r.status.padEnd(14)} ${r.id}  (${r.key})`);
  console.log(
    `\nInvestor: balance R$ ${(balanceCents / 100).toLocaleString("pt-BR")}, ` +
      `active investments R$ ${(activeCents / 100).toLocaleString("pt-BR")}, ` +
      `settled payouts R$ ${(settledPayoutCents / 100).toLocaleString("pt-BR")}`,
  );
  console.log(`\npassword: ${DEMO_PASSWORD}`);
  console.log("Login: POST /v1/auth/login with email + password above.");

  await dbHandle.close();
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
