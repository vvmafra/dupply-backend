import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

import * as schema from "./schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(databaseUrl: string): { db: Db; sqlite: Database.Database } {
  const path = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export function runMigrations(sqlite: Database.Database): void {
  const db = drizzle(sqlite, { schema });
  const migrationsFolder = join(__dirname, "../../drizzle");
  migrate(db, { migrationsFolder });
}

export { schema };
