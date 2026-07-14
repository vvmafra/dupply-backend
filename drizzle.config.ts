import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "file:./data/dupply.db";
const postgres =
  databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");

export default defineConfig({
  // SQLite tables use sqliteTable; Postgres (Supabase) needs pgTable — see schema.pg.ts
  schema: postgres ? "./src/infra/database/schema.pg.ts" : "./src/infra/database/schema.ts",
  out: "./drizzle",
  dialect: postgres ? "postgresql" : "sqlite",
  schemaFilter: postgres ? ["public"] : undefined,
  dbCredentials: {
    url: databaseUrl,
  },
});
