import type { FastifyInstance } from "fastify";

import type { AppDeps } from "./deps.js";
import { registerCookie } from "../plugins/cookie.js";
import { registerCors } from "../plugins/cors.js";
import { registerSwagger } from "../plugins/swagger.js";
import { requireDupplyApiKey } from "../plugins/dupply-auth.js";
import { requireJwt } from "../plugins/jwt-auth.js";
import { registerAuthModule } from "../modules/auth/api/registerAuthModule.js";
import { registerAccountModule } from "../modules/account/api/registerAccountModule.js";
import { registerSellerModule } from "../modules/seller/api/registerSellerModule.js";
import { registerWalletModule } from "../modules/wallet/api/registerWalletModule.js";
import { registerPayerModule } from "../modules/payer/api/registerPayerModule.js";
import { registerReceivableModule } from "../modules/receivable/api/registerReceivableModule.js";
import { registerReceivableInternalModule } from "../modules/receivable/api/registerReceivableInternalModule.js";
import { registerRegistryModule } from "../modules/registry/api/registerRegistryModule.js";
import { registerRampModule } from "../modules/ramp/api/registerRampModule.js";
import { registerRampWebhookModule } from "../modules/ramp/api/registerRampWebhookModule.js";

/**
 * Registers HTTP plugins and all route modules.
 * Phase 6: auth, account, seller, wallet, payer, receivable, registry, ramp use vertical modules.
 */
export async function registerAllModules(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  await registerCookie(app);
  await registerCors(app, deps.config);
  await registerSwagger(app, deps.config);

  // Public auth + payer magic link (matches former server.ts lines 64–67)
  await app.register(async (scope) => {
    await registerAuthModule(scope, deps);
    await registerPayerModule(scope, deps);
  });

  // JWT-protected platform routes (matches former server.ts lines 69–78)
  await app.register(
    async (scope) => {
      scope.addHook("preHandler", requireJwt(deps.config));
      await registerAccountModule(scope, deps);
      await registerSellerModule(scope, deps);
      await registerWalletModule(scope, deps);
      await registerReceivableModule(scope, deps);
    },
    { prefix: "" },
  );

  // API-key protected internal + ramp + registry (matches former server.ts lines 80–88)
  await app.register(
    async (scope) => {
      scope.addHook("preHandler", requireDupplyApiKey(deps.config));
      await registerReceivableInternalModule(scope, deps);
      await registerRampModule(scope, deps);
      await registerRegistryModule(scope, deps);
    },
    { prefix: "" },
  );

  await registerRampWebhookModule(app, deps);
}
