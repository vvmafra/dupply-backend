import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { loadConfig } from "../../../src/infra/env/config.js";
import type { DbHandle } from "../../../src/infra/database/index.js";
import { receivables } from "../../../src/infra/database/schema.runtime.js";
import { requireDupplyApiKey } from "../../../src/plugins/dupply-auth.js";
import { registerReceivableInternalRoutes } from "../../../src/modules/receivable/api/receivable-internal.js";
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

const API_KEY = "test-dupply-api-key";

async function createInternalApp(): Promise<{
  app: ReturnType<typeof Fastify>;
  deps: AppDeps;
  handle: DbHandle;
}> {
  const { deps, handle } = await createTestContext();
  const config = loadConfig({
    DATABASE_URL: "file::memory:",
    DUPPLY_API_KEY: API_KEY,
  });
  deps.config = config;

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(async (scope) => {
    scope.addHook("preHandler", requireDupplyApiKey(config));
    await registerReceivableInternalRoutes(scope, deps);
  });
  await app.ready();
  return { app, deps, handle };
}

async function confirmedReceivable(deps: AppDeps, sellerId: string): Promise<string> {
  const id = await createDraftReceivable(deps, sellerId);
  await executeUpdateReceivableDraft(deps, {
    receivableId: id,
    profileId: sellerId,
    receivableMetaData: completeReceivableMetaData,
  });
  await executeSubmitReceivable(deps, {
    receivableId: id,
    profileId: sellerId,
    actorRole: "seller",
  });
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

test("internal routes without API key return 401", async () => {
  const { app, handle } = await createInternalApp();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/internal/receivables/x/advance-settlement",
      payload: { targetStatus: "processing" },
    });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("full lifecycle without payer magic-link gate", async () => {
  const { app, deps, handle } = await createInternalApp();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await confirmedReceivable(deps, sellerId);

    const [afterAccept] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(afterAccept?.status, "confirmed");

    let res = await app.inject({
      method: "POST",
      url: `/v1/internal/receivables/${id}/advance-settlement`,
      headers: { "x-dupply-api-key": API_KEY },
      payload: { targetStatus: "processing" },
    });
    assert.equal(res.statusCode, 200);

    res = await app.inject({
      method: "POST",
      url: `/v1/internal/receivables/${id}/advance-settlement`,
      headers: { "x-dupply-api-key": API_KEY },
      payload: { targetStatus: "completed" },
    });
    assert.equal(res.statusCode, 200);

    res = await app.inject({
      method: "POST",
      url: `/v1/internal/receivables/${id}/payer-settlement`,
      headers: { "x-dupply-api-key": API_KEY },
      payload: { outcome: "settled" },
    });
    assert.equal(res.statusCode, 200);

    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, "payer_settled");
  } finally {
    await app.close();
    await handle.close();
  }
});

test("happy path advance and payer settlement via internal routes", async () => {
  const { app, deps, handle } = await createInternalApp();
  try {
    const { sellerId } = await setupActiveSeller(deps);
    const id = await confirmedReceivable(deps, sellerId);

    let res = await app.inject({
      method: "POST",
      url: `/v1/internal/receivables/${id}/advance-settlement`,
      headers: { "x-dupply-api-key": API_KEY },
      payload: { targetStatus: "processing" },
    });
    assert.equal(res.statusCode, 200);

    res = await app.inject({
      method: "POST",
      url: `/v1/internal/receivables/${id}/advance-settlement`,
      headers: { "x-dupply-api-key": API_KEY },
      payload: { targetStatus: "completed" },
    });
    assert.equal(res.statusCode, 200);

    res = await app.inject({
      method: "POST",
      url: `/v1/internal/receivables/${id}/payer-settlement`,
      headers: { "x-dupply-api-key": API_KEY },
      payload: { outcome: "settled" },
    });
    assert.equal(res.statusCode, 200);

    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    assert.equal(row?.status, "payer_settled");
  } finally {
    await app.close();
    await handle.close();
  }
});
