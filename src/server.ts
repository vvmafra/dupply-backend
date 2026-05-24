import Fastify from "fastify";

import { loadConfig } from "./config.js";
import { createDb, runMigrations } from "./db/index.js";
import { registerCors } from "./plugins/cors.js";
import { requireDupplyApiKey } from "./plugins/dupply-auth.js";
import { registerAccountRoutes } from "./routes/v1/accounts.js";
import { registerAuthRoutes } from "./routes/v1/auth.js";
import { registerReceivableInternalRoutes } from "./routes/v1/receivable-internal.js";
import { registerReceivableRoutes } from "./routes/v1/receivables.js";
import { registerTradeBillRoutes } from "./routes/v1/trade-bills.js";
import { registerRampRoutes } from "./routes/v1/ramp.js";
import { registerEtherfuseWebhook } from "./routes/v1/webhook-etherfuse.js";
import { requireJwt } from "./plugins/jwt-auth.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const dbHandle = createDb(config.DATABASE_URL);
  await runMigrations(dbHandle);
  const { db } = dbHandle;

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  app.get("/health", async () => ({ ok: true }));

  await registerCors(app, config);

  const appDeps = { db, config };

  await app.register(async (scope) => {
    await registerAuthRoutes(scope, appDeps);
  });

  await app.register(
    async (scope) => {
      scope.addHook("preHandler", requireJwt(config));
      await registerAccountRoutes(scope, appDeps);
      await registerReceivableRoutes(scope, appDeps);
    },
    { prefix: "" },
  );

  await app.register(
    async (scope) => {
      scope.addHook("preHandler", requireDupplyApiKey(config));
      await registerReceivableInternalRoutes(scope, appDeps);
      await registerRampRoutes(scope, { db, config });
      await registerTradeBillRoutes(scope, { db, config });
    },
    { prefix: "" },
  );

  await registerEtherfuseWebhook(app, { db, config });

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
