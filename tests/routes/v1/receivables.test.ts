import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers } from "../../../src/db/schema.runtime.js";
import type { AccountRole } from "../../../src/domain/account/types.js";
import { signAccessToken } from "../../../src/lib/jwt.js";
import { requireJwt } from "../../../src/plugins/jwt-auth.js";
import { registerAuthRoutes } from "../../../src/routes/v1/auth.js";
import { registerReceivableRoutes } from "../../../src/routes/v1/receivables.js";
import type { AppDeps } from "../../../src/application/deps.js";
import { insertAccount, TEST_PASSWORD } from "../../helpers/sellerTestHelpers.js";

type TestApp = {
  app: ReturnType<typeof Fastify>;
  deps: AppDeps;
  handle: DbHandle;
  config: ReturnType<typeof loadConfig>;
};

async function createTestApp(): Promise<TestApp> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({
    JWT_SECRET: "test-secret-min-16-chars",
    DATABASE_URL: "file::memory:",
  });
  const deps: AppDeps = { db: handle.db, config };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(async (scope) => {
    await registerAuthRoutes(scope, deps);
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", requireJwt(config));
    await registerReceivableRoutes(scope, deps);
  });

  await app.ready();
  return { app, deps, handle, config };
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

async function signToken(
  config: TestApp["config"],
  sub: string,
  role: AccountRole,
  profileId = `placeholder-${role}-${sub}`,
): Promise<string> {
  return signAccessToken(config, { sub, role, profileId });
}

async function activateSeller(deps: AppDeps, sellerId: string): Promise<void> {
  await deps.db
    .update(sellers)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(sellers.id, sellerId));
}

test("POST /v1/receivables with admin token returns 403", async () => {
  const { app, deps, handle, config } = await createTestApp();
  try {
    const { id: adminId } = await insertAccount(deps, { role: "admin" });
    const token = await signToken(config, adminId, "admin");

    const res = await app.inject({
      method: "POST",
      url: "/v1/receivables",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        payerUserId: randomUUID(),
        value: "1000.00",
      },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "forbidden" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/receivables with seller token returns 201", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { id: accountId, email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await activateSeller(deps, sellerId);
    const token = await loginAs(app, email);

    const res = await app.inject({
      method: "POST",
      url: "/v1/receivables",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        payerUserId: randomUUID(),
        value: "1000.00",
      },
    });
    assert.equal(res.statusCode, 201);
    assert.ok((res.json() as { id: string }).id);
    void accountId;
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/receivables/:id/risk-decision with seller token returns 403", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await activateSeller(deps, sellerId);
    const token = await loginAs(app, email);

    const res = await app.inject({
      method: "POST",
      url: `/v1/receivables/${randomUUID()}/risk-decision`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: "offer", proposedValue: "900.00" },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "forbidden" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/receivables/:id/risk-decision with risk_analyst token returns 404 for missing receivable", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email } = await insertAccount(deps, { role: "risk_analyst" });
    const token = await loginAs(app, email);

    const res = await app.inject({
      method: "POST",
      url: `/v1/receivables/${randomUUID()}/risk-decision`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: "reject" },
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/receivables/:id/confirm with seller token returns 403", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await activateSeller(deps, sellerId);
    const token = await loginAs(app, email);

    const res = await app.inject({
      method: "POST",
      url: `/v1/receivables/${randomUUID()}/confirm`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "forbidden" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/receivables/:id/confirm with payer token returns 404 for missing receivable", async () => {
  const { app, handle, config } = await createTestApp();
  try {
    const payerId = randomUUID();
    const token = await signToken(config, payerId, "payer");

    const res = await app.inject({
      method: "POST",
      url: `/v1/receivables/${randomUUID()}/confirm`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
    await handle.close();
  }
});
