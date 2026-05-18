# PostgreSQL local (Dupply)

Servidor **PostgreSQL 16** só para desenvolvimento, acessível com `psql` na porta **15432** no host (mapeia para 5432 no contentor). Ajusta em `docker-compose.postgres.yml` se a porta estiver ocupada.

## Subir

Na raiz do backend:

```bash
docker compose -f docker/docker-compose.postgres.yml up -d
```

## Ligar com `psql`

```bash
psql "postgresql://dupply:dupply@127.0.0.1:15432/dupply_local"
```

Ou:

```bash
export PGHOST=127.0.0.1
export PGPORT=15432
export PGUSER=dupply
export PGPASSWORD=dupply
export PGDATABASE=dupply_local
psql
```

## Parar / apagar dados

```bash
docker compose -f docker/docker-compose.postgres.yml down      # mantém volume
docker compose -f docker/docker-compose.postgres.yml down -v   # apaga volume (BD limpo)
```

## Variável para a API (quando usares Postgres no Drizzle)

```bash
DATABASE_URL=postgresql://dupply:dupply@127.0.0.1:15432/dupply_local
```

*(O pacote `packages/api` usa SQLite por omissão; migrar para Postgres implica trocar o dialect Drizzle — fora do âmbito deste compose.)*
