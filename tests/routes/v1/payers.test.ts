import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { loadConfig } from "../../../src/config.js";
import type { DbHandle } from "../../../src/db/index.js";
import { registerPayerRoutes } from "../../../src/routes/v1/payers.js";
import type { AppDeps } from "../../../src/application/deps.js";
import { createTestContext } from "../../helpers/receivableTestHelpers.js";

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

test("magic-link respond returns 410 Gone (deprecated)", async () => {
  const { app, handle } = await createPayerApp();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/payers/magic-link/respond",
      payload: { token: "any-token", decision: "accept" },
    });
    assert.equal(res.statusCode, 410);
    const body = res.json() as { error: string; message: string };
    assert.equal(body.error, "payer_confirmation_removed");
    assert.match(body.message, /seller accept/i);
  } finally {
    await app.close();
    await handle.close();
  }
});

test("invalid magic-link token still returns 410 (route deprecated)", async () => {
  const { app, handle } = await createPayerApp();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/payers/magic-link/respond",
      payload: { token: "invalid", decision: "accept" },
    });
    assert.equal(res.statusCode, 410);
    assert.equal((res.json() as { error: string }).error, "payer_confirmation_removed");
  } finally {
    await app.close();
    await handle.close();
  }
});
