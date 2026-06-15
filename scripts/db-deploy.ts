/**
 * Apply schema to Postgres (staging/prod) — NO data wipe, NO seed.
 *
 * Equivalent to `npm run db:push` with safety guards for remote databases.
 *
 * Usage (local Postgres — no extra flag):
 *   npm run db:deploy
 *
 * Usage (Supabase / Render / any remote host):
 *   CONFIRM_DB_DEPLOY=1 DATABASE_URL="postgresql://..." npm run db:deploy
 *
 * This is the production counterpart of db:reset:
 * - db:reset  → wipe + schema + seed (dev only)
 * - db:deploy → schema sync only (preserves rows)
 */
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../src/config.js";
import { isPostgresDatabaseUrl } from "../src/db/dialect.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const LOCAL_PG_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function redactDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    if (url.password) url.password = "****";
    return url.toString();
  } catch {
    return "[invalid DATABASE_URL]";
  }
}

function isLocalPostgresHost(databaseUrl: string): boolean {
  return LOCAL_PG_HOSTS.has(new URL(databaseUrl).hostname);
}

function assertSafeToDeploy(databaseUrl: string): void {
  if (!isPostgresDatabaseUrl(databaseUrl)) {
    throw new Error(
      "db:deploy targets Postgres only. For SQLite dev, use db:reset or db:migrate.",
    );
  }

  if (isLocalPostgresHost(databaseUrl)) {
    return;
  }

  if (process.env.CONFIRM_DB_DEPLOY !== "1") {
    const host = new URL(databaseUrl).hostname;
    throw new Error(
      `Refusing db:deploy on remote host "${host}" without confirmation.\n` +
        "This updates schema only (no wipe), but can still break prod if the schema drift is wrong.\n" +
        "Re-run with CONFIRM_DB_DEPLOY=1 when you intend to deploy to staging/production.",
    );
  }
}

async function main(): Promise<void> {
  const { DATABASE_URL } = loadConfig();
  assertSafeToDeploy(DATABASE_URL);

  const host = new URL(DATABASE_URL).hostname;
  const scope = isLocalPostgresHost(DATABASE_URL) ? "local" : "remote";

  console.log("Deploying database schema (data preserved)...\n");
  console.log(`Target (${scope}): ${redactDatabaseUrl(DATABASE_URL)}\n`);
  console.log("→ npm run db:push\n");

  execSync("npm run db:push", { cwd: ROOT, stdio: "inherit", env: process.env });

  console.log("\n✓ db:deploy complete — no data was deleted or seeded.");
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
