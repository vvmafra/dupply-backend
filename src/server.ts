import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

import { loadConfig } from "./infra/env/config.js";
import { createDb, runMigrations } from "./infra/database/index.js";
import { createGateways } from "./infra/gateways/factories/createGateways.js";
import { createAppDeps } from "./compose/deps.js";
import { registerAllModules } from "./compose/registerModules.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const dbHandle = createDb(config.DATABASE_URL);
  await runMigrations(dbHandle);
  const { db } = dbHandle;
  const gateways = createGateways(config);

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (
      error !== null &&
      typeof error === "object" &&
      "validation" in error &&
      "statusCode" in error &&
      (error as { statusCode: unknown }).statusCode === 400
    ) {
      return reply.code(400).send({
        error: "validation_error",
        details: (error as { validation: unknown }).validation,
      });
    }
    void reply.send(error);
  });

  app.get("/health", async () => ({ ok: true }));

  const appDeps = createAppDeps({ db, config, gateways });
  await registerAllModules(app, appDeps);

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
