/** True when `DATABASE_URL` targets PostgreSQL (Supabase, local docker, etc.). */
export function isPostgresDatabaseUrl(databaseUrl: string): boolean {
  return (
    databaseUrl.startsWith("postgresql://") ||
    databaseUrl.startsWith("postgres://")
  );
}
