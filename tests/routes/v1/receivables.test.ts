import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { receivables } from "../../../src/db/schema.runtime.js";
import type { AccountRole } from "../../../src/domain/account/types.js";
import { signAccessToken } from "../../../src/lib/jwt.js";
import { requireJwt } from "../../../src/plugins/jwt-auth.js";
import { registerAuthRoutes } from "../../../src/routes/v1/auth.js";
import { registerReceivableRoutes } from "../../../src/routes/v1/receivables.js";
import type { AppDeps } from "../../../src/application/deps.js";
import {
  completeReceivableMetaData,
  PAYER_CNPJ,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";
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
        payerCnpj: PAYER_CNPJ,
        payerLegalName: "Payer Corp",
        payerFinancialEmail: "finance@payer.com",
        value: "50000",
      },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "forbidden" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/receivables with seller token returns 201 draft", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await setupActiveSeller(deps);
    const token = await loginAs(app, email);

    const res = await app.inject({
      method: "POST",
      url: "/v1/receivables",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        payerCnpj: PAYER_CNPJ,
        payerLegalName: "Payer Corp",
        payerFinancialEmail: "finance@payer.com",
        value: "50000",
      },
    });
    assert.equal(res.statusCode, 201);
    const { id } = res.json() as { id: string };
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, "created");
    assert.equal(row?.sellerId, sellerId);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/receivables inactive seller returns 403 seller_not_active", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email } = await insertAccount(deps);
    const token = await loginAs(app, email);
    const res = await app.inject({
      method: "POST",
      url: "/v1/receivables",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        payerCnpj: PAYER_CNPJ,
        payerLegalName: "Payer Corp",
        payerFinancialEmail: "finance@payer.com",
      },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "seller_not_active" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/receivables/:id/confirm returns 404 (removed)", async () => {
  const { app, handle } = await createTestApp();
  try {
    const res = await app.inject({
      method: "POST",
      url: `/v1/receivables/${randomUUID()}/confirm`,
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("GET /v1/receivables as seller returns only own receivables", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const sellerA = await setupActiveSeller(deps);
    const sellerB = await setupActiveSeller(deps);
    const tokenA = await loginAs(app, sellerA.email);

    for (const seller of [sellerA, sellerB]) {
      const token = await loginAs(app, seller.email);
      await app.inject({
        method: "POST",
        url: "/v1/receivables",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          payerCnpj: PAYER_CNPJ,
          payerLegalName: "Payer Corp",
          payerFinancialEmail: "finance@payer.com",
        },
      });
    }

    const res = await app.inject({
      method: "GET",
      url: "/v1/receivables",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { receivables: { sellerId: string }[] };
    assert.equal(body.receivables.length, 1);
    assert.equal(body.receivables[0]?.sellerId, sellerA.sellerId);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/receivables/:id/risk-decision with seller token returns 403", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email } = await setupActiveSeller(deps);
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

test("full draft flow patch and submit", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email } = await setupActiveSeller(deps);
    const token = await loginAs(app, email);

    const createRes = await app.inject({
      method: "POST",
      url: "/v1/receivables",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        payerCnpj: PAYER_CNPJ,
        payerLegalName: "Payer Corp",
        payerFinancialEmail: "finance@payer.com",
      },
    });
    const { id } = createRes.json() as { id: string };

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/v1/receivables/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { receivableMetaData: completeReceivableMetaData, value: "50000" },
    });
    assert.equal(patchRes.statusCode, 200);

    const submitRes = await app.inject({
      method: "POST",
      url: `/v1/receivables/${id}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(submitRes.statusCode, 200);
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, "under_review");
  } finally {
    await app.close();
    await handle.close();
  }
});
