import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import * as jose from "jose";

import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers } from "../../../src/db/schema.runtime.js";
import { registerCookie } from "../../../src/plugins/cookie.js";
import { requireJwt } from "../../../src/plugins/jwt-auth.js";
import { registerAuthRoutes } from "../../../src/routes/v1/auth.js";
import { registerSellerRoutes } from "../../../src/routes/v1/sellers.js";
import type { AppDeps } from "../../../src/application/deps.js";
import {
  completeBusinessRelationsMetaData,
  completeCompanyMetaData,
  completeLegalRepMetaData,
  insertAccount,
  TEST_PASSWORD,
} from "../../helpers/sellerTestHelpers.js";

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
  const deps: AppDeps = { db: handle.db, config };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerCookie(app);

  await app.register(async (scope) => {
    await registerAuthRoutes(scope, deps);
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", requireJwt(config));
    await registerSellerRoutes(scope, deps);
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

test("full seller onboarding flow: register → PATCH → submit → admin approve → GET", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const registerRes = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "new-seller@example.com",
        password: TEST_PASSWORD,
        name: "Nova Empresa",
        role: "seller",
      },
    });
    assert.equal(registerRes.statusCode, 201);
    const registerBody = registerRes.json() as {
      accessToken: string;
      sellerId: string;
    };
    assert.ok(registerBody.accessToken);
    assert.ok(registerBody.sellerId);

    const secret = new TextEncoder().encode("test-secret-min-16-chars");
    const { payload } = await jose.jwtVerify(registerBody.accessToken, secret, {
      issuer: loadConfig({ JWT_SECRET: "test-secret-min-16-chars" }).JWT_ISSUER,
    });
    assert.equal(payload.profileId, registerBody.sellerId);

    const sellerToken = registerBody.accessToken;
    const sellerId = registerBody.sellerId;

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/v1/sellers/${sellerId}`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: {
        companyMetaData: completeCompanyMetaData,
        legalRepresentativeMetaData: completeLegalRepMetaData,
        businessRelationsMetaData: completeBusinessRelationsMetaData,
      },
    });
    assert.equal(patchRes.statusCode, 200);

    const submitRes = await app.inject({
      method: "POST",
      url: `/v1/sellers/${sellerId}/submit`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(submitRes.statusCode, 204);

    const lockedPatch = await app.inject({
      method: "PATCH",
      url: `/v1/sellers/${sellerId}`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { name: "Blocked" },
    });
    assert.equal(lockedPatch.statusCode, 409);
    assert.deepEqual(lockedPatch.json(), { error: "metadata_locked" });

    const { id: adminId, email: adminEmail } = await insertAccount(deps, { role: "admin" });
    void adminId;
    const adminToken = await loginAs(app, adminEmail);

    const approveRes = await app.inject({
      method: "PATCH",
      url: `/v1/sellers/${sellerId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: "active" },
    });
    assert.equal(approveRes.statusCode, 204);

    const getRes = await app.inject({
      method: "GET",
      url: `/v1/sellers/${sellerId}`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(getRes.statusCode, 200);
    const profile = getRes.json() as { status: string; companyMetaData: { shareCapital: number } };
    assert.equal(profile.status, "active");
    assert.equal(profile.companyMetaData.shareCapital, 150000);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/auth/register rejects unsupported role", async () => {
  const { app, handle } = await createTestApp();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "admin@example.com",
        password: TEST_PASSWORD,
        name: "Admin",
        role: "admin",
      },
    });
    // Role "admin" is rejected by Zod schema (z.literal("seller")) as a validation error
    assert.equal(res.statusCode, 400);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("GET /v1/sellers/:id returns 403 for different seller", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { id: ownerId, email, sellerId: ownerSellerId } = await insertAccount(deps);
    const { sellerId: otherSellerId } = await insertAccount(deps);
    void ownerId;
    assert.ok(ownerSellerId && otherSellerId);

    const token = await loginAs(app, email);

    const res = await app.inject({
      method: "GET",
      url: `/v1/sellers/${otherSellerId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "forbidden" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("PATCH /v1/sellers/:id/status by non-admin returns 403", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    const token = await loginAs(app, email);

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/sellers/${sellerId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "active" },
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("DELETE /v1/sellers/:id by non-admin returns 403", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const token = await loginAs(app, email);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/sellers/${sellerId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("DELETE /v1/sellers/:id by admin returns 204", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const { email: adminEmail } = await insertAccount(deps, { role: "admin" });
    const adminToken = await loginAs(app, adminEmail);

    const res = await app.inject({
      method: "DELETE",
      url: `/v1/sellers/${sellerId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.statusCode, 204);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("PATCH /v1/sellers/:id/status without token returns 401", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    await deps.db
      .update(sellers)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(sellers.id, sellerId));

    const res = await app.inject({
      method: "PATCH",
      url: `/v1/sellers/${sellerId}/status`,
      payload: { status: "active" },
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: "unauthorized" });
  } finally {
    await app.close();
    await handle.close();
  }
});
