import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

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
