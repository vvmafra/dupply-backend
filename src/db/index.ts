import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import dns from "node:dns";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import pg from "pg";

import { isPostgresDatabaseUrl } from "./dialect.js";
import * as schemaSqlite from "./schema.js";
import * as schemaPg from "./schema.pg.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type SqliteDb = ReturnType<typeof drizzleSqlite<typeof schemaSqlite>>;
type PgDb = ReturnType<typeof drizzlePg<typeof schemaPg>>;

/**
 * App-facing Drizzle handle (SQLite-shaped types).
 * Postgres uses the same schema; instance is cast at runtime in `createDb`.
 */
export type Db = SqliteDb;

export type DbHandle = {
  db: Db;
  dialect: "sqlite" | "postgresql";
  close: () => void | Promise<void>;
};

export function createDb(databaseUrl: string): DbHandle {
  if (isPostgresDatabaseUrl(databaseUrl)) {
    dns.setDefaultResultOrder("ipv4first");
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("supabase.com")
        ? { rejectUnauthorized: false }
        : undefined,
    });
    const db = drizzlePg(pool, { schema: schemaPg }) as unknown as Db;
    return {
      db,
      dialect: "postgresql",
      close: async () => {
        await pool.end();
      },
    };
  }

  const path = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzleSqlite(sqlite, { schema: schemaSqlite });
  return {
    db,
    dialect: "sqlite",
    close: () => {
      sqlite.close();
    },
  };
}

/**
 * Applies SQL migrations in `drizzle/` (SQLite only).
 * On Postgres/Supabase use `npm run db:push` — files under `drizzle/*.sql` are SQLite-oriented.
 */
export async function runMigrations(handle: DbHandle): Promise<void> {
  if (handle.dialect === "postgresql") {
    return;
  }
  const migrationsFolder = join(__dirname, "../../drizzle");
  migrateSqlite(handle.db as SqliteDb, { migrationsFolder });
}

export { schemaSqlite as schema };
