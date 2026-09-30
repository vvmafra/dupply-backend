import type { AppConfig } from "../infra/env/config.js";
import type { Db } from "../infra/database/index.js";
import type { Gateways } from "../infra/gateways/factories/createGateways.js";
import type { NotifyPayerReceivableConfirmedInput } from "../modules/payer/application/ports/receivableNotification.js";
import { notifyPayerReceivableConfirmed as defaultNotifyPayerReceivableConfirmed } from "../modules/payer/application/ports/receivableNotification.js";

/** Composition root: passed into application-layer handlers (commands / queries). */
export type AppDeps = {
  db: Db;
  config: AppConfig;
  gateways: Gateways;
  logger?: {
    warn?: (obj: Record<string, unknown>, msg: string) => void;
  };
  /** Cross-module callback: receivable → payer (wired here; modules must not import each other's domain). */
  notifyPayerReceivableConfirmed?: (
    deps: AppDeps,
    input: NotifyPayerReceivableConfirmedInput,
  ) => Promise<void>;
};

/** Build AppDeps with composition-root defaults (payer notification stub, etc.). */
export function createAppDeps(input: {
  db: Db;
  config: AppConfig;
  gateways: Gateways;
  logger?: AppDeps["logger"];
  notifyPayerReceivableConfirmed?: AppDeps["notifyPayerReceivableConfirmed"];
}): AppDeps {
  return {
    db: input.db,
    config: input.config,
    gateways: input.gateways,
    logger: input.logger,
    notifyPayerReceivableConfirmed:
      input.notifyPayerReceivableConfirmed ?? defaultNotifyPayerReceivableConfirmed,
  };
}
