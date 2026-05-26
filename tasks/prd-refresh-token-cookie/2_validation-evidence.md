# Validation evidence — Task 2.0: Enable CORS credentials

## Changes made

- `src/plugins/cors.ts`: added `credentials: true` to the `@fastify/cors` registration options so the browser forwards cookies on cross-origin requests when the frontend uses `credentials: "include"` (FR-9). Origin allowlist logic is unchanged — no wildcard origin introduced.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 225 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified via `tsc -p tsconfig.json`.
- [x] `credentials: true` is present in `src/plugins/cors.ts` — added to cors registration options.
- [x] Origin allowlist logic is unchanged (no wildcard origin) — existing `origin` callback with `allowed` Set retained; disallowed origins still rejected via `callback(null, false)`.
- [x] No pre-existing tests broken — all 225 tests pass.

## Notes

No deviations from the techspec. Only `credentials: true` was added per techspec § Component 5; no other CORS options modified.
