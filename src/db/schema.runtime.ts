/**
 * Table handles for the active `DATABASE_URL` (read at module load; use `--env-file=.env`).
 * SQLite → `schema.ts`; Postgres/Supabase → `schema.pg.ts`.
 */
import { isPostgresDatabaseUrl } from "./dialect.js";
import * as sqlite from "./schema.js";
import * as pg from "./schema.pg.js";

const url = process.env.DATABASE_URL ?? "file:./data/dupply.db";
const mod = isPostgresDatabaseUrl(url) ? pg : sqlite;

export const accounts = mod.accounts;
export const sellers = mod.sellers;
export const wallets = mod.wallets;
export const WALLET_STATUSES = mod.WALLET_STATUSES;
export const WALLET_NETWORKS = mod.WALLET_NETWORKS;
export const WALLET_TYPES = mod.WALLET_TYPES;
export const WALLET_PARENT_TYPES = mod.WALLET_PARENT_TYPES;
export const payers = mod.payers;
export const receivables = mod.receivables;
export const rampQuotes = mod.rampQuotes;
export const rampOrders = mod.rampOrders;
export const tradeBillDrafts = mod.tradeBillDrafts;
export const tradeBillChainRecords = mod.tradeBillChainRecords;
