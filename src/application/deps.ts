import type { AppConfig } from "../config.js";
import type { Db } from "../db/index.js";
import type { NotifyPayerReceivableConfirmedInput } from "./payer/ports/receivableNotification.js";

/** Composition root: passed into application-layer handlers (commands / queries). */
export type AppDeps = {
  db: Db;
  config: AppConfig;
  logger?: {
    warn?: (obj: Record<string, unknown>, msg: string) => void;
  };
  notifyPayerReceivableConfirmed?: (
    deps: AppDeps,
    input: NotifyPayerReceivableConfirmedInput,
  ) => Promise<void>;
};
