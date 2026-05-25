import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { sellers } from "../../../src/db/schema.runtime.js";
import { requireJwt } from "../../../src/plugins/jwt-auth.js";
import { registerAuthRoutes } from "../../../src/routes/v1/auth.js";
import { registerSellerRoutes } from "../../../src/routes/v1/sellers.js";
import { registerWalletRoutes } from "../../../src/routes/v1/wallets.js";
import type { AppDeps } from "../../../src/application/deps.js";
import {
  completeBusinessRelationsMetaData,
  completeCompanyMetaData,
  completeLegalRepMetaData,
  insertAccount,
  TEST_PASSWORD,
} from "../../helpers/sellerTestHelpers.js";
import { validRegisterWalletPayload, VALID_CONTRACT_ID_ALT } from "../../helpers/walletTestHelpers.js";

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

  await app.register(async (scope) => {
    await registerAuthRoutes(scope, deps);
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", requireJwt(config));
    await registerSellerRoutes(scope, deps);
    await registerWalletRoutes(scope, deps);
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

async function approveSeller(
  app: TestApp["app"],
  deps: AppDeps,
  sellerId: string,
  sellerToken: string,
): Promise<string> {
  await app.inject({
    method: "PATCH",
    url: `/v1/sellers/${sellerId}`,
    headers: { authorization: `Bearer ${sellerToken}` },
    payload: {
      companyMetaData: completeCompanyMetaData,
      legalRepresentativeMetaData: completeLegalRepMetaData,
      businessRelationsMetaData: completeBusinessRelationsMetaData,
    },
  });

  await app.inject({
    method: "POST",
    url: `/v1/sellers/${sellerId}/submit`,
    headers: { authorization: `Bearer ${sellerToken}` },
  });

  const { email: adminEmail } = await insertAccount(deps, { role: "admin" });
  const adminToken = await loginAs(app, adminEmail);

  const approveRes = await app.inject({
    method: "PATCH",
    url: `/v1/sellers/${sellerId}/status`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { status: "active" },
  });
  assert.equal(approveRes.statusCode, 204);
  return adminToken;
}

test("full flow: approve seller → register wallet → GET seller shows walletId", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const sellerToken = await loginAs(app, email);
    await approveSeller(app, deps, sellerId, sellerToken);

    const registerRes = await app.inject({
      method: "POST",
      url: `/v1/sellers/${sellerId}/wallet`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: validRegisterWalletPayload(),
    });
    assert.equal(registerRes.statusCode, 201);
    const walletBody = registerRes.json() as Record<string, unknown>;
    assert.equal(walletBody.type, "smart_account");
    assert.equal(walletBody.sellerId, sellerId);
    assert.ok(!("secretEncrypted" in walletBody));

    const getSellerRes = await app.inject({
      method: "GET",
      url: `/v1/sellers/${sellerId}`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(getSellerRes.statusCode, 200);
    const sellerProfile = getSellerRes.json() as { walletId: string | null };
    assert.equal(sellerProfile.walletId, walletBody.id);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST register wallet returns 403 for non-active seller", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const sellerToken = await loginAs(app, email);

    const res = await app.inject({
      method: "POST",
      url: `/v1/sellers/${sellerId}/wallet`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: validRegisterWalletPayload(),
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "seller_not_active" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("duplicate wallet registration returns 409", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const sellerToken = await loginAs(app, email);
    await approveSeller(app, deps, sellerId, sellerToken);

    const first = await app.inject({
      method: "POST",
      url: `/v1/sellers/${sellerId}/wallet`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: validRegisterWalletPayload(),
    });
    assert.equal(first.statusCode, 201);

    const second = await app.inject({
      method: "POST",
      url: `/v1/sellers/${sellerId}/wallet`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: validRegisterWalletPayload({
        contractId: VALID_CONTRACT_ID_ALT,
      }),
    });
    assert.equal(second.statusCode, 409);
    assert.deepEqual(second.json(), { error: "wallet_already_exists" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("seller cannot register wallet for another seller", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const first = await insertAccount(deps);
    const second = await insertAccount(deps);
    assert.ok(first.sellerId);
    assert.ok(second.sellerId);

    const firstToken = await loginAs(app, first.email);
    await approveSeller(app, deps, first.sellerId, firstToken);
    const secondToken = await loginAs(app, second.email);
    await deps.db
      .update(sellers)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(sellers.id, second.sellerId!));

    const res = await app.inject({
      method: "POST",
      url: `/v1/sellers/${first.sellerId}/wallet`,
      headers: { authorization: `Bearer ${secondToken}` },
      payload: validRegisterWalletPayload(),
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "forbidden" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("GET /v1/sellers/:id/wallet returns 404 when wallet not created", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const sellerToken = await loginAs(app, email);
    await approveSeller(app, deps, sellerId, sellerToken);

    const res = await app.inject({
      method: "GET",
      url: `/v1/sellers/${sellerId}/wallet`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.json(), { error: "wallet_not_found" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("admin can PATCH wallet status; seller receives 403", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const sellerToken = await loginAs(app, email);
    const adminToken = await approveSeller(app, deps, sellerId, sellerToken);

    const registerRes = await app.inject({
      method: "POST",
      url: `/v1/sellers/${sellerId}/wallet`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: validRegisterWalletPayload(),
    });
    const walletId = (registerRes.json() as { id: string }).id;

    const sellerPatch = await app.inject({
      method: "PATCH",
      url: `/v1/wallets/${walletId}/status`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: { status: "inactive" },
    });
    assert.equal(sellerPatch.statusCode, 403);

    const adminPatch = await app.inject({
      method: "PATCH",
      url: `/v1/wallets/${walletId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: "inactive" },
    });
    assert.equal(adminPatch.statusCode, 200);
    assert.equal((adminPatch.json() as { status: string }).status, "inactive");
  } finally {
    await app.close();
    await handle.close();
  }
});

test("GET /v1/wallets/:id returns wallet without secretEncrypted", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const sellerToken = await loginAs(app, email);
    await approveSeller(app, deps, sellerId, sellerToken);

    const registerRes = await app.inject({
      method: "POST",
      url: `/v1/sellers/${sellerId}/wallet`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: validRegisterWalletPayload(),
    });
    const walletId = (registerRes.json() as { id: string }).id;

    const getRes = await app.inject({
      method: "GET",
      url: `/v1/wallets/${walletId}`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(getRes.statusCode, 200);
    const body = getRes.json() as Record<string, unknown>;
    assert.equal(body.id, walletId);
    assert.ok(!("secretEncrypted" in body));
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST register wallet rejects invalid contractId", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email, sellerId } = await insertAccount(deps);
    assert.ok(sellerId);
    const sellerToken = await loginAs(app, email);
    await approveSeller(app, deps, sellerId, sellerToken);

    const res = await app.inject({
      method: "POST",
      url: `/v1/sellers/${sellerId}/wallet`,
      headers: { authorization: `Bearer ${sellerToken}` },
      payload: validRegisterWalletPayload({ contractId: "GINVALID" }),
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), { error: "validation_error" });
  } finally {
    await app.close();
    await handle.close();
  }
});
