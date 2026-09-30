# Validation evidence — Task 7.0: Legacy cleanup

## Changes made

- `scripts/*.ts` (`seed-dev.ts`, `db-deploy.ts`, `db-reset.ts`, `etherfuse-smoke.ts`, `etherfuse-kyc-smoke.ts`): imports updated to `infra/env`, `infra/database`, `infra/gateways/providers/etherfuse`, `modules/seller/domain`
- `tests/**` (helpers, route suites, account/seller/wallet module tests, `tests/lib/*`): imports updated from legacy `config`/`db`/`lib`/`application`/`domain` to `infra/*`, `compose/deps`, `modules/*`
- `src/plugins/require-roles.ts`, `src/types/fastify.d.ts`: `AccountRole` import → `modules/account/domain/types`
- Deleted legacy horizontal-layer paths (FR-17):
  - `src/domain/`
  - `src/application/`
  - `src/routes/`
  - `src/integrations/`
  - `src/config.ts`
  - `src/db/`
  - `src/lib/`
  - `src/generated/`
- No temporary shim re-exports kept — all in-repo consumers were updated (FR-17)

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 295 passing
```

Integration smoke (manual via `registerAllModules` + inject):

```
GET /health → 200 {"ok":true}
POST /v1/auth/login {} → 400 validation (route registered)
GET /v1/receivables → 401 (JWT scope registered)
createGateways → covered by tests/infra/gateways/gateways.test.ts (three ports)
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified
- [x] Unit tests pass (`npm test`) — 295/295
- [x] No imports remain from deleted legacy paths (grep clean) — verified across `src/plugins`, `src/types`, `scripts`, `tests`
- [x] Legacy horizontal-layer directories removed — only `compose/`, `infra/`, `modules/`, `plugins/`, `shared/`, `types/`, `server.ts` remain under `src/`
- [x] Script import paths updated — all five scripts point at infra/modules
- [x] All existing route test suites pass — included in 295
- [x] No pre-existing tests broken — 0 failures

## Notes

- **No shims:** Phase 8 deleted re-export stubs rather than leaving temporary shims; external/script consumers in this repo were migrated first.
- **Kept (per OQ-1 / OQ-4):** `src/plugins/`, `src/shared/money.ts`, `src/server.ts`, `src/compose/`, `src/modules/`, `src/infra/`, `src/types/`.
- Governance docs/rules/skills still mention legacy paths in places — that is **Task 8.0** (FR-19–FR-28), out of scope here.
