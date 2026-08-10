import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { loadConfig } from "../../../src/infra/env/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/infra/database/index.js";
import { registerCookie } from "../../../src/plugins/cookie.js";
import { requireJwt } from "../../../src/plugins/jwt-auth.js";
import { registerAuthRoutes } from "../../../src/modules/auth/api/auth.js";
import { registerInvestorRoutes } from "../../../src/modules/investor/api/investors.js";
import type { AppDeps } from "../../../src/compose/deps.js";
import { insertInvestor, TEST_PASSWORD } from "../../helpers/investorTestHelpers.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";
import { createGateways } from "../../../src/infra/gateways/factories/createGateways.js";
import { payers, receivables } from "../../../src/infra/database/schema.runtime.js";

type TestApp = {
  app: ReturnType<typeof Fastify>;
  deps: AppDeps;
  handle: DbHandle;
};

async function createTestApp(): Promise<TestApp> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({
    JWT_SECRET: "test-secret-min-16-chars",
    DATABASE_URL: "file::memory:",
  });
  const deps: AppDeps = { db: handle.db, config, gateways: createGateways(config) };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerCookie(app);

  await app.register(async (scope) => {
    await registerAuthRoutes(scope, deps);
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", requireJwt(config));
    await registerInvestorRoutes(scope, deps);
  });

  await app.ready();
  return { app, deps, handle };
}

async function loginAs(
  app: TestApp["app"],
  email: string,
  password = TEST_PASSWORD,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password },
  });
  assert.equal(res.statusCode, 200);
  return (res.json() as { accessToken: string }).accessToken;
}

test("Investor routes - deposit flow & get profile & list deposits", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, investorId } = await insertInvestor(deps);
    const token = await loginAs(app, email);

    // 1. Perform a deposit
    const depositRes = await app.inject({
      method: "POST",
      url: "/v1/investors/deposit",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        amount: 250.75,
        idempotencyKey: "unique-dep-key-1",
        externalTxId: "ext-1",
      },
    });

    assert.equal(depositRes.statusCode, 201);
    const depositBody = depositRes.json() as {
      id: string;
      investorId: string;
      amount: number;
      status: string;
    };
    assert.ok(depositBody.id);
    assert.equal(depositBody.investorId, investorId);
    assert.equal(depositBody.amount, 250.75);
    assert.equal(depositBody.status, "completed");

    // 2. Query investor profile & check balance
    const meRes = await app.inject({
      method: "GET",
      url: "/v1/investors/me",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(meRes.statusCode, 200);
    const meBody = meRes.json() as {
      id: string;
      name: string;
      email: string;
      balance: number;
    };
    assert.equal(meBody.id, investorId);
    assert.equal(meBody.email, email);
    assert.equal(meBody.balance, 250.75);

    // 3. List deposits
    const listRes = await app.inject({
      method: "GET",
      url: "/v1/investors/deposits",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(listRes.statusCode, 200);
    const listBody = listRes.json() as any[];
    assert.equal(listBody.length, 1);
    assert.equal(listBody[0].id, depositBody.id);
    assert.equal(listBody[0].amount, 250.75);
    assert.equal(listBody[0].idempotencyKey, "unique-dep-key-1");
  } finally {
    await app.close();
    await handle.close();
  }
});

test("Investor routes - unauthorized requests return 401", async () => {
  const { app, handle } = await createTestApp();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/investors/deposit",
      payload: {
        amount: 100.00,
        idempotencyKey: "some-key",
      },
    });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("Investor routes - non-investor roles (seller) return 403", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email } = await insertAccount(deps, { role: "seller" });
    const token = await loginAs(app, email);

    const res = await app.inject({
      method: "POST",
      url: "/v1/investors/deposit",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        amount: 100.00,
        idempotencyKey: "some-key",
      },
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("Investor routes - withdraw flow & list withdrawals", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, investorId } = await insertInvestor(deps);
    const token = await loginAs(app, email);

    // 1. Deposit first to get balance
    const depRes = await app.inject({
      method: "POST",
      url: "/v1/investors/deposit",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        amount: 500.00,
        idempotencyKey: "dep-key",
      },
    });
    assert.equal(depRes.statusCode, 201);

    // 2. Perform a withdrawal
    const withdrawRes = await app.inject({
      method: "POST",
      url: "/v1/investors/withdraw",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        amount: 120.50,
        idempotencyKey: "unique-withdraw-key-1",
        pixKey: "my-pix-key",
      },
    });

    assert.equal(withdrawRes.statusCode, 201);
    const withdrawBody = withdrawRes.json() as {
      id: string;
      investorId: string;
      amount: number;
      pixKey: string;
      status: string;
    };
    assert.ok(withdrawBody.id);
    assert.equal(withdrawBody.investorId, investorId);
    assert.equal(withdrawBody.amount, 120.50);
    assert.equal(withdrawBody.pixKey, "my-pix-key");
    assert.equal(withdrawBody.status, "completed");

    // 3. Query profile to check balance is deducted (500 - 120.50 = 379.50)
    const meRes = await app.inject({
      method: "GET",
      url: "/v1/investors/me",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(meRes.statusCode, 200);
    assert.equal((meRes.json() as any).balance, 379.50);

    // 4. List withdrawals
    const listRes = await app.inject({
      method: "GET",
      url: "/v1/investors/withdrawals",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = listRes.json() as any[];
    assert.equal(listBody.length, 1);
    assert.equal(listBody[0].id, withdrawBody.id);
    assert.equal(listBody[0].amount, 120.50);
    assert.equal(listBody[0].pixKey, "my-pix-key");
    assert.equal(listBody[0].idempotencyKey, "unique-withdraw-key-1");
  } finally {
    await app.close();
    await handle.close();
  }
});

test("Investor routes - withdraw returns 400 for insufficient funds", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email } = await insertInvestor(deps);
    const token = await loginAs(app, email);

    // Attempt to withdraw when balance is 0
    const res = await app.inject({
      method: "POST",
      url: "/v1/investors/withdraw",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        amount: 50.00,
        idempotencyKey: "w-key",
        pixKey: "pix-key",
      },
    });

    assert.equal(res.statusCode, 400);
    assert.equal((res.json() as any).error, "insufficient_funds");
  } finally {
    await app.close();
    await handle.close();
  }
});

async function insertTestReceivable(
  deps: AppDeps,
  sellerId: string,
  overrides: {
    targetFundingCents?: number;
    fundedCents?: number;
    status?: string;
  } = {},
): Promise<string> {
  const payerId = createId();
  const receivableId = createId();
  const now = new Date();

  await deps.db.insert(payers).values({
    id: payerId,
    legalName: "Test Payer LTDA",
    email: "payer@example.com",
    cnpj: `cnpj-${payerId}`,
    createdAt: now,
    updatedAt: now,
  });

  await deps.db.insert(receivables).values({
    id: receivableId,
    sellerId: sellerId,
    payerId: payerId,
    status: overrides.status ?? "funding",
    value: "1000.00",
    targetFundingCents: overrides.targetFundingCents ?? 100000,
    fundedCents: overrides.fundedCents ?? 0,
    yieldRateAnnual: 0.15,
    createdAt: now,
    updatedAt: now,
  });

  return receivableId;
}

test("Investor routes - invest flow, auto-transition, list & idempotency", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email: investorEmail, investorId } = await insertInvestor(deps);
    const { sellerId } = await insertAccount(deps, { role: "seller" });
    assert.ok(sellerId);

    const token = await loginAs(app, investorEmail);

    // 1. Setup receivable open for funding
    const receivableId = await insertTestReceivable(deps, sellerId, {
      targetFundingCents: 50000, // R$ 500,00
      status: "funding",
    });

    // 2. Deposit funds for the investor
    await app.inject({
      method: "POST",
      url: "/v1/investors/deposit",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        amount: 1000.00,
        idempotencyKey: "dep-key",
      },
    });

    // 3. Perform a partial investment of R$ 200,00
    const investRes = await app.inject({
      method: "POST",
      url: "/v1/investors/invest",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        receivableId,
        amount: 200.00,
        idempotencyKey: "invest-key-1",
      },
    });

    assert.equal(investRes.statusCode, 201);
    const investBody = investRes.json() as any;
    assert.ok(investBody.id);
    assert.equal(investBody.investorId, investorId);
    assert.equal(investBody.receivableId, receivableId);
    assert.equal(investBody.amount, 200.00);
    assert.equal(investBody.status, "active");

    // 4. Verify balance is deducted (1000 - 200 = 800)
    const meRes = await app.inject({
      method: "GET",
      url: "/v1/investors/me",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal((meRes.json() as any).balance, 800.00);

    // 5. Verify receivable state (funded cents = 20000, status = funding)
    const [rec1] = await deps.db.select().from(receivables).where(eq(receivables.id, receivableId)).limit(1);
    assert.equal(rec1.fundedCents, 20000);
    assert.equal(rec1.status, "funding");

    // 6. Test Idempotency: re-submit the same investment, should return success but not double debit
    const idempRes = await app.inject({
      method: "POST",
      url: "/v1/investors/invest",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        receivableId,
        amount: 200.00,
        idempotencyKey: "invest-key-1",
      },
    });
    assert.equal(idempRes.statusCode, 201);
    const idempBody = idempRes.json() as any;
    assert.equal(idempBody.id, investBody.id);
    assert.equal(idempBody.investorId, investBody.investorId);
    assert.equal(idempBody.receivableId, investBody.receivableId);
    assert.equal(idempBody.amount, investBody.amount);
    assert.equal(idempBody.status, investBody.status);

    const meRes2 = await app.inject({
      method: "GET",
      url: "/v1/investors/me",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal((meRes2.json() as any).balance, 800.00);

    // 7. Invest remaining R$ 300,00 to reach 100% funding target
    const investRes2 = await app.inject({
      method: "POST",
      url: "/v1/investors/invest",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        receivableId,
        amount: 300.00,
        idempotencyKey: "invest-key-2",
      },
    });
    assert.equal(investRes2.statusCode, 201);

    // 8. Verify receivable auto-transitioned to 'funded'
    const [rec2] = await deps.db.select().from(receivables).where(eq(receivables.id, receivableId)).limit(1);
    assert.equal(rec2.fundedCents, 50000);
    assert.equal(rec2.status, "funded");

    // 9. List investments
    const listRes = await app.inject({
      method: "GET",
      url: "/v1/investors/investments",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(listRes.statusCode, 200);
    const listBody = listRes.json() as any[];
    assert.equal(listBody.length, 2);
    const amounts = listBody.map((b) => b.amount);
    assert.ok(amounts.includes(200.00));
    assert.ok(amounts.includes(300.00));
    assert.equal(listBody[0].receivable.status, "funded");
  } finally {
    await app.close();
    await handle.close();
  }
});

test("Investor routes - invest failure cases", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email: investorEmail } = await insertInvestor(deps);
    const { sellerId } = await insertAccount(deps, { role: "seller" });
    assert.ok(sellerId);

    const token = await loginAs(app, investorEmail);

    const receivableId = await insertTestReceivable(deps, sellerId, {
      targetFundingCents: 50000,
      status: "funding",
    });

    // 1. Insufficient funds
    const failFundRes = await app.inject({
      method: "POST",
      url: "/v1/investors/invest",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        receivableId,
        amount: 100.00,
        idempotencyKey: "fail-key-1",
      },
    });
    assert.equal(failFundRes.statusCode, 400);
    assert.equal((failFundRes.json() as any).error, "insufficient_funds");

    // Deposit R$ 1000,00 to allow remaining checks
    await app.inject({
      method: "POST",
      url: "/v1/investors/deposit",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        amount: 1000.00,
        idempotencyKey: "dep-key",
      },
    });

    // 2. Investment exceeds remaining target
    const failExceedRes = await app.inject({
      method: "POST",
      url: "/v1/investors/invest",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        receivableId,
        amount: 600.00, // Target is 500
        idempotencyKey: "fail-key-2",
      },
    });
    assert.equal(failExceedRes.statusCode, 400);
    assert.equal((failExceedRes.json() as any).error, "investment_exceeds_remaining_funding");

    // 3. Receivable not open for funding (status confirmed)
    const closedReceivableId = await insertTestReceivable(deps, sellerId, {
      targetFundingCents: 50000,
      status: "confirmed",
    });
    const failStatusRes = await app.inject({
      method: "POST",
      url: "/v1/investors/invest",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        receivableId: closedReceivableId,
        amount: 100.00,
        idempotencyKey: "fail-key-3",
      },
    });
    assert.equal(failStatusRes.statusCode, 400);
    assert.equal((failStatusRes.json() as any).error, "receivable_not_open_for_funding");

    // 4. Receivable not found
    const failNotFoundRes = await app.inject({
      method: "POST",
      url: "/v1/investors/invest",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        receivableId: "non-existent",
        amount: 100.00,
        idempotencyKey: "fail-key-4",
      },
    });
    assert.equal(failNotFoundRes.statusCode, 404);
    assert.equal((failNotFoundRes.json() as any).error, "receivable_not_found");
  } finally {
    await app.close();
    await handle.close();
  }
});
