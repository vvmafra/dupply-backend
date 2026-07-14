# Validation evidence — Task 5.0: Registry module + Stellar blockchain consolidation

## Changes made

- `src/infra/blockchain/stellar/network.ts`: moved from `integrations/stellar/network.ts`
- `src/infra/blockchain/stellar/registry/**`: moved from `integrations/registry/**` (`issue-flow`, `confirm-tx`, `soroban-config`)
- `src/infra/gateways/providers/stellar/stellarRegistryGateway.ts`: imports blockchain paths; wraps `AssembledTransaction.Errors.SimulationFailed` in `getOnChainBill` so modules never touch `@stellar/stellar-sdk`
- `src/modules/registry/domain/tradeBill/dto.ts`: moved from `domain/tradeBill/` (OQ-2 naming preserved)
- `src/modules/registry/application/`: mappers, `appConfigToRegistrySoroban`, `registryErrors` re-exports, commands (`simulateTradeBill`, `confirmTradeBill`), queries (`getTradeBill`, `getOnChainTradeBill`)
- `src/modules/registry/api/trade-bills.ts` + `registerRegistryModule.ts`: thin HTTP layer calling application; no SDK / integrations imports
- `src/compose/registerModules.ts`: API-key scope uses `registerRegistryModule`
- Legacy paths (`domain/tradeBill`, `application/tradeBill`, `routes/v1/trade-bills`, `integrations/registry`, `integrations/stellar`): temporary re-exports until Phase 8
- `tests/modules/registry/**`: domain invariant tests + gateway-delegation command test; extended `tests/infra/gateways/gateways.test.ts` with `confirmTx` delegation

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 293 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified
- [x] Unit tests pass (`npm test`) — 293/293
- [x] `/v1/trade-bills/*` routes behave identically — same paths/handlers via thin API + commands; error/status mapping preserved
- [x] No `@stellar/stellar-sdk` imports in `src/modules/registry/**` — grep clean
- [x] Stellar/Soroban code lives under `src/infra/blockchain/stellar/**` — verified
- [x] `integrations/registry/` and `integrations/stellar/` emptied of logic — re-exports only
- [x] No pre-existing tests broken — all prior suites still pass (+5 new)

## Notes

- **Temporary re-exports** left at legacy registry/stellar paths until Phase 8 cleanup (same pattern as Tasks 1–4).
- **`appConfigToRegistrySoroban`** moved into the module for completeness but simulate/confirm/on-chain flows use `deps.gateways.registry` (gateway maps config internally).
- **Empty `{}` from `getOnChainBill`** maps to `tradeBill: null` in the query to preserve the previous HTTP shape (port cannot return null).
- **FR-5:** no imports between `modules/ramp` and `modules/registry`.
