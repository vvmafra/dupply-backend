import type { AppConfig } from "../config.js";
import type { Db } from "../db/index.js";

/** Composition root: passed into application-layer handlers (commands / queries). */
export type AppDeps = {
  db: Db;
  config: AppConfig;
};
