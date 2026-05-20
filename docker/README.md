# Local PostgreSQL (Dupply)

**PostgreSQL 16** for development only, reachable with `psql` on host port **15432** (maps to 5432 in the container). Change `docker-compose.postgres.yml` if the port is in use.

## Start

From the backend root:

```bash
docker compose -f docker/docker-compose.postgres.yml up -d
```

## Connect with `psql`

```bash
psql "postgresql://dupply:dupply@127.0.0.1:15432/dupply_local"
```

Or:

```bash
export PGHOST=127.0.0.1
export PGPORT=15432
export PGUSER=dupply
export PGPASSWORD=dupply
export PGDATABASE=dupply_local
psql
```

## Stop / delete data

```bash
docker compose -f docker/docker-compose.postgres.yml down      # keeps volume
docker compose -f docker/docker-compose.postgres.yml down -v   # removes volume (clean DB)
```

## API env (when using Postgres with Drizzle)

```bash
DATABASE_URL=postgresql://dupply:dupply@127.0.0.1:15432/dupply_local
```

*(The Node API in `src/` defaults to SQLite; switching to Postgres requires changing the Drizzle dialect — out of scope for this compose file.)*
