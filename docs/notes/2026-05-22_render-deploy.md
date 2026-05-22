# Deploy no Render

## Causa do exit 9

`npm start` usava `tsx --env-file=.env`. O ficheiro `.env` não existe no Render (está no `.gitignore`); variáveis vêm do **Environment** do serviço.

**Correções:**
1. `start` → `node dist/server.js` (sem `--env-file`). Local com `.env`: `npm run start:local`.
2. `tsconfig.build.json` com `rootDir: "src"` — senão o `tsc` gera `dist/src/server.js` e o start falha com `MODULE_NOT_FOUND`.

## Render — configurar

| Variável | Obrigatório | Notas |
|----------|-------------|--------|
| `DATABASE_URL` | Sim (prod) | Postgres/Supabase pooler IPv4, ex. `postgresql://...@aws-1-....pooler.supabase.com:5432/postgres` |
| `JWT_SECRET` | Sim | ≥ 16 caracteres |
| `DUPPLY_API_KEY` | Sim | Header `X-Dupply-Api-Key` |
| `PORT` | Auto | Render injeta; default app `8080` se não setado |
| `HOST` | `0.0.0.0` | Recomendado |
| `NODE_ENV` | `production` | |
| `ETHERFUSE_*` | Opcional | Ramp |
| `DUPPLY_REGISTRY_CONTRACT_ID` | Opcional | Trade bills |

**Build command:** `npm install && npm run build`  
**Start command:** `npm start`

Após primeiro deploy: aplicar schema (`npm run db:push` local com `DATABASE_URL` de prod, ou SQL `drizzle/0003_*.sql`).

## Referência

- [Render Node deploy](https://render.com/docs/deploy-node-express-app)
- [Node `--env-file`](https://nodejs.org/api/cli.html#--env-fileconfig) — só local; não commitar `.env`
