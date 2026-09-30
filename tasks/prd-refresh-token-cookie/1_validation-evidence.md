# Validation evidence — Task 1.0: Register `@fastify/cookie` plugin

## Changes made

- `package.json` / `package-lock.json`: added `@fastify/cookie` (^11.0.2) via `npm install @fastify/cookie`.
- `src/plugins/cookie.ts`: created `registerCookie` that registers the Fastify cookie plugin without a signing secret (plain token transport only).
- `src/server.ts`: imported `registerCookie` and called `await registerCookie(app)` immediately after serializer/validator setup and before `registerCors` and route plugins (FR-8).

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 225 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified via `tsc -p tsconfig.json`.
- [x] `@fastify/cookie` appears in `package.json` dependencies — `"@fastify/cookie": "^11.0.2"`.
- [x] `src/plugins/cookie.ts` exports `registerCookie` — file created per techspec § Component 3.
- [x] Cookie plugin is registered before CORS and route plugins in `src/server.ts` — `registerCookie` runs before `registerCors`.
- [x] No pre-existing tests broken — all 225 tests pass.

## Notes

No deviations from the techspec. Cookie signing secret intentionally omitted per FR-8 / techspec § Component 1.
