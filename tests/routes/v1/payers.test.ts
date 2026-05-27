import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { encodeStubMagicLinkToken } from "../../../src/application/payer/ports/magicLinkToken.js";
import { loadConfig } from "../../../src/config.js";
import { createDb, runMigrations, type DbHandle } from "../../../src/db/index.js";
import { receivables } from "../../../src/db/schema.runtime.js";
import { registerPayerRoutes } from "../../../src/routes/v1/payers.js";
import type { AppDeps } from "../../../src/application/deps.js";
import {
  completeReceivableMetaData,
  createTestContext,
  setupActiveSeller,
} from "../../helpers/receivableTestHelpers.js";
import { executeUpdateReceivableDraft } from "../../../src/application/receivable/commands/updateReceivableDraftCommand.js";
import { executeSubmitReceivable } from "../../../src/application/receivable/commands/submitReceivableCommand.js";
import { executeRiskDecision } from "../../../src/application/receivable/commands/riskDecisionCommand.js";
import { executeSellerDecision } from "../../../src/application/receivable/commands/sellerDecisionCommand.js";
import { createDraftReceivable } from "../../helpers/receivableTestHelpers.js";

async function createPayerApp(): Promise<{
  app: ReturnType<typeof Fastify>;
  deps: AppDeps;
  handle: DbHandle;
}> {
  const { deps, handle } = await createTestContext();
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  deps.config = config;

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await registerPayerRoutes(app, deps);
  await app.ready();
  return { app, deps, handle };
}

test("magic-link respond accessible without JWT", async () => {
  const { app, deps, handle } = await createPayerApp();
  try {
    const { sellerId } = await setupActiveSeller(deps);
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
    const [row] = await deps.db.select().from(receivables).where(eq(receivables.id, id));
    const token = encodeStubMagicLinkToken({ receivableId: id, payerId: row!.payerId });

    const res = await app.inject({
      method: "POST",
      url: "/v1/payers/magic-link/respond",
      payload: { token, decision: "accept" },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  } finally {
    await app.close();
    await handle.close();
  }
});

test("invalid magic-link token returns 400", async () => {
  const { app, handle } = await createPayerApp();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/payers/magic-link/respond",
      payload: { token: "invalid", decision: "accept" },
    });
    assert.equal(res.statusCode, 400);
    assert.equal((res.json() as { error: string }).error, "invalid_magic_link_token");
  } finally {
    await app.close();
    await handle.close();
  }
});
