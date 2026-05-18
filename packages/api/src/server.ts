import Fastify from "fastify";

import { loadConfig } from "./config.js";
import { createDb, runMigrations } from "./db/index.js";
import { requireDupplyApiKey } from "./plugins/dupply-auth.js";
import { registerDuplicataRoutes } from "./routes/v1/duplicatas.js";
import { registerRampRoutes } from "./routes/v1/ramp.js";
import { registerEtherfuseWebhook } from "./routes/v1/webhook-etherfuse.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { db, sqlite } = createDb(config.DATABASE_URL);
  runMigrations(sqlite);

  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(
    async (scope) => {
      scope.addHook("preHandler", requireDupplyApiKey(config));
      await registerRampRoutes(scope, { db, config });
      await registerDuplicataRoutes(scope, { db, config });
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
