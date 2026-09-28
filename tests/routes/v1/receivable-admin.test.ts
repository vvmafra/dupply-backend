import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { loadConfig } from "../../../src/infra/env/config.js";
import type { DbHandle } from "../../../src/infra/database/index.js";
import { receivables } from "../../../src/infra/database/schema.runtime.js";
import type { AccountRole } from "../../../src/modules/account/domain/types.js";
import { signAccessToken } from "../../../src/infra/auth/jwt.js";
import { requireJwt } from "../../../src/plugins/jwt-auth.js";
import { registerReceivableAdminRoutes } from "../../../src/modules/receivable/api/receivable-admin.js";
import type { AppDeps } from "../../../src/compose/deps.js";
import { executeRiskDecision } from "../../../src/modules/receivable/application/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../../src/modules/receivable/application/commands/sellerDecisionCommand.js";
import { executeSubmitReceivable } from "../../../src/modules/receivable/application/commands/submitReceivableCommand.js";
import { executeUpdateReceivableDraft } from "../../../src/modules/receivable/application/commands/updateReceivableDraftCommand.js";
import {
  completeReceivableMetaData,
  createDraftReceivable,
  createTestContext,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";
import { insertAccount } from "../../helpers/sellerTestHelpers.js";

type TestApp = {
  app: ReturnType<typeof Fastify>;
  deps: AppDeps;
  handle: DbHandle;
  config: ReturnType<typeof loadConfig>;
};

async function createAdminApp(): Promise<TestApp> {
  const { deps, handle } = await createTestContext();
  const config = loadConfig({
    JWT_SECRET: "test-secret-min-16-chars",
    DATABASE_URL: "file::memory:",
  });
  deps.config = config;

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(async (scope) => {
    scope.addHook("preHandler", requireJwt(config));
    await registerReceivableAdminRoutes(scope, deps);
  });
  await app.ready();
  return { app, deps, handle, config };
}

async function tokenFor(
  ctx: TestApp,
  role: AccountRole,
): Promise<string> {
  const { id } = await insertAccount(ctx.deps, { role });
  return signAccessToken(ctx.config, { sub: id, role, profileId: `placeholder-${role}-${id}` });
}

async function confirmedReceivable(deps: AppDeps, sellerId: string): Promise<string> {
  const id = await createDraftReceivable(deps, sellerId);
  await executeUpdateReceivableDraft(deps, {
    receivableId: id,
    profileId: sellerId,
    receivableMetaData: completeReceivableMetaData,
  });
  await executeSubmitReceivable(deps, { receivableId: id, profileId: sellerId, actorRole: "seller" });
  await executeRiskDecision(deps, {
    receivableId: id,
    actorRole: "risk_analyst",
    decision: "offer",
    proposedValue: 450,
  });
  await executeSellerDecision(deps, {
    receivableId: id,
    profileId: sellerId,
    actorRole: "seller",
    decision: "accept",
  });
  return id;
}

test("POST /v1/admin/receivables/:id/open-funding without token returns 401", async () => {
  const ctx = await createAdminApp();
  try {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/admin/receivables/x/open-funding",
    });
    assert.equal(res.statusCode, 401);
  } finally {
    await ctx.app.close();
    await ctx.handle.close();
  }
});

test("POST /v1/admin/receivables/:id/open-funding with seller token returns 403", async () => {
  const ctx = await createAdminApp();
  try {
    const { sellerId } = await setupActiveSeller(ctx.deps);
    const id = await confirmedReceivable(ctx.deps, sellerId);
    const token = await tokenFor(ctx, "seller");

    const res = await ctx.app.inject({
      method: "POST",
      url: `/v1/admin/receivables/${id}/open-funding`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.json(), { error: "forbidden" });

    const [row] = await ctx.deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, "confirmed");
  } finally {
    await ctx.app.close();
    await ctx.handle.close();
  }
});

test("POST /v1/admin/receivables/:id/open-funding as admin moves confirmed → funding", async () => {
  const ctx = await createAdminApp();
  try {
    const { sellerId } = await setupActiveSeller(ctx.deps);
    const id = await confirmedReceivable(ctx.deps, sellerId);
    const token = await tokenFor(ctx, "admin");

    const res = await ctx.app.inject({
      method: "POST",
      url: `/v1/admin/receivables/${id}/open-funding`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { from: "confirmed", to: "funding", targetFunding: 450 });

    const [row] = await ctx.deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, "funding");
    assert.equal(row?.targetFundingCents, 45000);

    // second call: already in funding → 409
    const again = await ctx.app.inject({
      method: "POST",
      url: `/v1/admin/receivables/${id}/open-funding`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(again.statusCode, 409);
  } finally {
    await ctx.app.close();
    await ctx.handle.close();
  }
});

test("POST /v1/admin/receivables/:id/open-funding unknown id returns 404", async () => {
  const ctx = await createAdminApp();
  try {
    const token = await tokenFor(ctx, "admin");
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/admin/receivables/missing/open-funding",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await ctx.app.close();
    await ctx.handle.close();
  }
});
