import assert from "node:assert/strict";
import test from "node:test";

import { createId } from "@paralleldrive/cuid2";
import argon2 from "argon2";
import Fastify from "fastify";
import * as jose from "jose";

import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { accounts } from "../../../src/db/schema.runtime.js";
import { mockProfileId } from "../../../src/domain/account/profileId.js";
import { requireJwt } from "../../../src/plugins/jwt-auth.js";
import { registerAccountRoutes } from "../../../src/routes/v1/accounts.js";
import { registerAuthRoutes } from "../../../src/routes/v1/auth.js";
import type { AppDeps } from "../../../src/application/deps.js";

const TEST_PASSWORD = "test-password-123";

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

  await app.register(async (scope) => {
    await registerAuthRoutes(scope, deps);
  });

  await app.register(async (scope) => {
    scope.addHook("preHandler", requireJwt(config));
    await registerAccountRoutes(scope, deps);
  });

  await app.ready();
  return { app, deps, handle };
}

async function insertAccount(
  deps: AppDeps,
  overrides: Partial<typeof accounts.$inferInsert> = {},
): Promise<{ id: string; email: string }> {
  const id = createId();
  const email = overrides.email ?? `user-${id}@example.com`;
  const passwordHash = overrides.passwordHash ?? (await argon2.hash(TEST_PASSWORD));
  const now = new Date();

  await deps.db.insert(accounts).values({
    id,
    email,
    passwordHash,
    role: "seller",
    status: "active",
    refreshToken: null,
    refreshTokenLookup: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });

  return { id, email };
}

test("login → refresh → GET account → logout flow with profileId in JWT", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { id, email } = await insertAccount(deps);

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: TEST_PASSWORD },
    });
    assert.equal(loginRes.statusCode, 200);
    const loginBody = loginRes.json() as {
      accessToken: string;
      refreshToken: string;
      tokenType: string;
      expiresInSeconds: number;
      refreshExpiresInSeconds: number;
    };
    assert.equal(loginBody.tokenType, "Bearer");
    assert.ok(loginBody.accessToken.length > 0);
    assert.ok(loginBody.refreshToken.length > 0);
    assert.equal(loginBody.expiresInSeconds, deps.config.JWT_ACCESS_TTL_SECONDS);
    assert.equal(loginBody.refreshExpiresInSeconds, deps.config.JWT_REFRESH_TTL_SECONDS);

    const secret = new TextEncoder().encode(deps.config.JWT_SECRET);
    const { payload } = await jose.jwtVerify(loginBody.accessToken, secret, {
      issuer: deps.config.JWT_ISSUER,
    });
    assert.equal(payload.sub, id);
    assert.equal(payload.role, "seller");
    assert.equal(payload.profileId, mockProfileId(id, "seller"));
    assert.equal(payload.principalKind, undefined);

    const refreshRes = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: loginBody.refreshToken },
    });
    assert.equal(refreshRes.statusCode, 200);
    const refreshBody = refreshRes.json() as {
      accessToken: string;
      refreshToken: string;
    };
    assert.notEqual(refreshBody.refreshToken, loginBody.refreshToken);
    assert.ok(refreshBody.accessToken.length > 0);

    const getRes = await app.inject({
      method: "GET",
      url: `/v1/accounts/${id}`,
      headers: { authorization: `Bearer ${refreshBody.accessToken}` },
    });
    assert.equal(getRes.statusCode, 200);
    const account = getRes.json() as {
      id: string;
      email: string;
      role: string;
      status: string;
    };
    assert.equal(account.id, id);
    assert.equal(account.email, email);
    assert.equal(account.role, "seller");
    assert.equal(account.status, "active");
    assert.ok(!("passwordHash" in account));
    assert.ok(!("refreshToken" in account));

    const logoutRes = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { authorization: `Bearer ${refreshBody.accessToken}` },
    });
    assert.equal(logoutRes.statusCode, 204);

    const refreshAfterLogout = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken: refreshBody.refreshToken },
    });
    assert.equal(refreshAfterLogout.statusCode, 401);
    assert.deepEqual(refreshAfterLogout.json(), { error: "invalid_refresh_token" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("POST /v1/auth/login maps auth errors to HTTP status", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { email } = await insertAccount(deps, { status: "inactive" });

    const inactiveRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: TEST_PASSWORD },
    });
    assert.equal(inactiveRes.statusCode, 403);
    assert.deepEqual(inactiveRes.json(), { error: "account_inactive" });

    const wrongRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "wrong-password" },
    });
    assert.equal(wrongRes.statusCode, 401);
    assert.deepEqual(wrongRes.json(), { error: "invalid_credentials" });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("GET /v1/accounts/:id returns 403 for non-owner non-admin", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { id: ownerId, email } = await insertAccount(deps);
    const { id: otherId } = await insertAccount(deps);

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: TEST_PASSWORD },
    });
    const { accessToken } = loginRes.json() as { accessToken: string };

    const getRes = await app.inject({
      method: "GET",
      url: `/v1/accounts/${otherId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(getRes.statusCode, 403);
    assert.deepEqual(getRes.json(), { error: "forbidden" });

    const ownRes = await app.inject({
      method: "GET",
      url: `/v1/accounts/${ownerId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(ownRes.statusCode, 200);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("PATCH /v1/accounts/:id updates password and returns 204", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { id, email } = await insertAccount(deps);
    const newPassword = "new-password-789";

    const loginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: TEST_PASSWORD },
    });
    const { accessToken } = loginRes.json() as { accessToken: string };

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/v1/accounts/${id}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { password: newPassword },
    });
    assert.equal(patchRes.statusCode, 204);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: TEST_PASSWORD },
    });
    assert.equal(oldLogin.statusCode, 401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: newPassword },
    });
    assert.equal(newLogin.statusCode, 200);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("DELETE /v1/accounts/:id is admin-only", async () => {
  const { app, deps, handle } = await createTestApp();
  try {
    const { id: targetId } = await insertAccount(deps);
    const adminId = createId();
    const adminEmail = `admin-${adminId}@example.com`;
    await insertAccount(deps, {
      id: adminId,
      email: adminEmail,
      role: "admin",
    });

    const { email: sellerEmail } = await insertAccount(deps);
    const sellerLoginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: sellerEmail, password: TEST_PASSWORD },
    });
    const sellerToken = (sellerLoginRes.json() as { accessToken: string }).accessToken;

    const forbiddenRes = await app.inject({
      method: "DELETE",
      url: `/v1/accounts/${targetId}`,
      headers: { authorization: `Bearer ${sellerToken}` },
    });
    assert.equal(forbiddenRes.statusCode, 403);
    assert.deepEqual(forbiddenRes.json(), { error: "forbidden" });

    const adminLoginRes = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: adminEmail, password: TEST_PASSWORD },
    });
    const adminToken = (adminLoginRes.json() as { accessToken: string }).accessToken;

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/v1/accounts/${targetId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteRes.statusCode, 204);

    const getRes = await app.inject({
      method: "GET",
      url: `/v1/accounts/${targetId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(getRes.statusCode, 404);
    assert.deepEqual(getRes.json(), { error: "account_not_found" });
  } finally {
    await app.close();
    await handle.close();
  }
});
