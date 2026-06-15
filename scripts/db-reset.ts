/**
 * Reset dev database: wipe → schema → seed (Prisma migrate reset equivalent).
 *
 * Usage: `npm run db:reset`
 *
 * Safety:
 * - Refuses NODE_ENV=production unless FORCE_DB_RESET=1
 * - Refuses remote Postgres unless ALLOW_REMOTE_DB_RESET=1
 *
 * Stop the API server before running — active connections block DROP DATABASE.
 */
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadConfig } from "../src/config.js";
import { isPostgresDatabaseUrl } from "../src/db/dialect.js";
import { createDb, runMigrations } from "../src/db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LOCAL_PG_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function parseDatabaseName(databaseUrl: string): string {
  const name = decodeURIComponent(
    new URL(databaseUrl).pathname.replace(/^\//, "").split("/")[0] ?? "",
  );
  if (!name) {
    throw new Error("Could not parse database name from DATABASE_URL.");
  }
  return name;
}

function isLocalPostgresHost(databaseUrl: string): boolean {
  return LOCAL_PG_HOSTS.has(new URL(databaseUrl).hostname);
}

function assertSafeToReset(databaseUrl: string): void {
  if (process.env.NODE_ENV === "production" && process.env.FORCE_DB_RESET !== "1") {
    throw new Error(
      "Refusing db:reset in production. Set FORCE_DB_RESET=1 to override.",
    );
  }

  if (isPostgresDatabaseUrl(databaseUrl) && !isLocalPostgresHost(databaseUrl)) {
    if (process.env.ALLOW_REMOTE_DB_RESET !== "1") {
      const host = new URL(databaseUrl).hostname;
      throw new Error(
        `Refusing db:reset on remote host "${host}". ` +
          "Set ALLOW_REMOTE_DB_RESET=1 if you really mean it.",
      );
    }
  }
}

function resetSqlite(databaseUrl: string): void {
  const path = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;

  if (path === ":memory:") {
    throw new Error("Cannot reset in-memory SQLite.");
  }

  const absPath = resolve(ROOT, path);
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = suffix ? `${absPath}${suffix}` : absPath;
    if (existsSync(file)) {
      unlinkSync(file);
      console.log(`removed ${file}`);
    }
  }
}

async function resetPostgresSchema(databaseUrl: string): Promise<void> {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase.com")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    console.log("dropped and recreated public schema");
  } finally {
    await client.end();
  }
}

async function resetPostgresLocal(databaseUrl: string): Promise<void> {
  const dbName = parseDatabaseName(databaseUrl);
  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = "/postgres";

  const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();

  try {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [dbName],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)}`);
    await client.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
    console.log(`recreated database: ${dbName}`);
  } catch (error) {
    console.warn(
      "drop/create database failed (stop the API server and retry). Falling back to schema reset.",
    );
    console.warn(error instanceof Error ? error.message : error);
    await client.end();
    await resetPostgresSchema(databaseUrl);
    return;
  }

  await client.end();
}

function runDbPush(): void {
  console.log("\n→ npm run db:push\n");
  execSync("npm run db:push", { cwd: ROOT, stdio: "inherit", env: process.env });
}

function runSeed(): void {
  console.log("\n→ npm run seed:dev\n");
  execSync("npm run seed:dev", { cwd: ROOT, stdio: "inherit", env: process.env });
}

async function main(): Promise<void> {
  const { DATABASE_URL } = loadConfig();
  assertSafeToReset(DATABASE_URL);

  console.log("Resetting database...\n");
  console.log(`DATABASE_URL=${DATABASE_URL.replace(/:[^:@/]+@/, ":****@")}\n`);

  if (isPostgresDatabaseUrl(DATABASE_URL)) {
    if (isLocalPostgresHost(DATABASE_URL)) {
      await resetPostgresLocal(DATABASE_URL);
    } else {
      await resetPostgresSchema(DATABASE_URL);
    }
    runDbPush();
  } else {
    resetSqlite(DATABASE_URL);
    const handle = createDb(DATABASE_URL);
    await runMigrations(handle);
    await handle.close();
  }

  runSeed();
  console.log("\n✓ db:reset complete");
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
