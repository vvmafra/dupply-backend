# Validation evidence — Task 6.0: Ramp module + Etherfuse provider consolidation

## Changes made

- `src/infra/gateways/providers/etherfuse/client.ts`, `webhook-verify.ts`, `kyc-types.ts`: moved from `integrations/etherfuse/**`
- `src/infra/gateways/providers/etherfuse/etherfuseRampGateway.ts`: imports consolidated local client; added `createOrder`; expanded `createQuote` to full quote assets
- `src/infra/gateways/ports/rampGateway.ts`: port extended with `createOrder`, full `RampQuoteRequest` / `RampQuoteAssets`, `RampAssetRow`
- `src/modules/ramp/api/`: `ramp.ts`, `webhook-etherfuse.ts`, `registerRampModule.ts`, `registerRampWebhookModule.ts`
- `src/modules/ramp/application/`: queries (`getRampAssets`, `getRampOrderById`), commands (`createRampQuote`, `createRampOrder`, `applyRampWebhook`), helpers + error re-export — all use `deps.gateways.ramp`
- `src/modules/ramp/domain/.gitkeep`: placeholder (no domain rules yet; FR-2 folder required)
- `src/compose/registerModules.ts`: API-key scope uses `registerRampModule`; top-level `registerRampWebhookModule`
- Legacy paths (`routes/v1/ramp`, `webhook-etherfuse`, `application/ramp`, `integrations/etherfuse`): temporary re-exports until Phase 8
- `tests/modules/ramp/application/**`: gateway-delegation tests for getAssets + createQuote
- `src/infra/gateways/README.md`: Phase 6 note updated

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 295 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified
- [x] Unit tests pass (`npm test`) — 295/295
- [x] Ramp routes (`/v1/ramp/*`) behave identically — same paths/handlers via thin API + application; error/status mapping preserved
- [x] Webhook route behaves identically (signature verification unchanged) — `verifyWebhookSignature` via gateway wrapping same `webhook-verify.ts`
- [x] No direct Etherfuse client imports in `src/modules/ramp/application/**` — grep clean (only `EtherfuseHttpError` re-export for HTTP mapping)
- [x] Etherfuse code lives under `src/infra/gateways/providers/etherfuse/**` — verified
- [x] `integrations/etherfuse/` emptied of logic — re-exports only
- [x] No pre-existing tests broken — all prior suites still pass (+2 new)

## Notes

- **Temporary re-exports** left at legacy ramp/etherfuse paths until Phase 8 cleanup (same pattern as Tasks 1–5).
- **RampGateway port extended** beyond the minimal techspec sketch (`createOrder` + full quote assets) so module API/application never construct `EtherfuseClient` (FR-4).
- **`domain/`** is an empty placeholder — no ramp domain rules existed before the move.
- **FR-5:** no imports between `modules/ramp` and `modules/registry`.
