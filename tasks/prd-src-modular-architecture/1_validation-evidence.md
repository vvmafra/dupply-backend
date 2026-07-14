# Validation evidence — Task 1.0: Infrastructure foundations

## Changes made

- `src/infra/env/config.ts`: moved from `src/config.ts` (temporary re-export at old path)
- `src/infra/database/**`: moved from `src/db/**`; migrations path updated; temporary re-exports at `src/db/**`
- `src/infra/generated/**`: moved from `src/generated/**`; temporary re-export at old path
- `src/infra/auth/**`: moved `jwt.ts`, `refreshToken.ts`, `authCookie.ts` from `src/lib/**`; temporary re-exports at old paths
- `src/infra/gateways/ports/{registry,ramp,settlement}Gateway.ts`: port interfaces for FR-11
- `src/infra/gateways/providers/stellar/stellarRegistryGateway.ts`: wraps `integrations/registry/*` (Phase 5 will move blockchain code)
- `src/infra/gateways/providers/etherfuse/etherfuseRampGateway.ts`: wraps `integrations/etherfuse/*` (Phase 6 will relocate client)
- `src/infra/gateways/providers/blindpay/blindPaySettlementGateway.ts`: stub that throws “not implemented”
- `src/infra/gateways/factories/createGateways.ts`: factory returning all three ports
- `src/infra/gateways/README.md`: documents ports vs providers vs factories (FR-28)
- `src/compose/deps.ts`: composition root with `gateways: Gateways`; temporary re-export from `application/deps.ts`
- `src/modules/settlement/**`: placeholder dirs + README
- `drizzle.config.ts`: schema paths → `./src/infra/database/schema(.pg).ts`
- `src/server.ts` + `src/plugins/**`: imports updated to infra paths; `createGateways` wired into `AppDeps`
- `tests/infra/gateways/gateways.test.ts`: unit tests for factory, Stellar delegate, Etherfuse mock, BlindPay stub
- Test helpers/routes that build `AppDeps`: now include `gateways: createGateways(config)`

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 288 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified
- [x] Unit tests pass (`npm test`) — 288/288
- [x] `createGateways(config)` returns object implementing all three port interfaces — covered by `tests/infra/gateways/gateways.test.ts`
- [x] BlindPay stub `initiatePixPayment` throws "not implemented" — covered by test
- [x] `src/compose/deps.ts` exports extended `AppDeps` with `gateways` — verified
- [x] Settlement placeholder module exists with README — `src/modules/settlement/`
- [x] `src/infra/gateways/README.md` documents ports/providers/factories — verified
- [x] No pre-existing tests broken — all prior suites still pass

## Notes

- **Temporary re-exports** left at `src/config.ts`, `src/db/**`, `src/lib/**`, `src/generated/**`, and `src/application/deps.ts` until Phase 8 cleanup (task allowed optional re-exports).
- **`SimulateIssueInput`** uses `issuerPublicKey` (not techspec’s `issuerSecret`) to match existing `simulateIssue` API.
- **`RampGateway.getAssets`** takes `{ blockchain, currency, wallet }` because the Etherfuse client requires those query params; techspec showed a no-arg signature.
- **`RampGateway.verifyWebhookSignature`** takes `Record<string, unknown>` body (Etherfuse JCS verify), not `Buffer`.
- **`ConfirmTxResult`** includes `issuedAtUnix` from the existing confirm-tx parser; `tradeBill` is `{}` until routes pass issuer (use `getOnChainBill`).
- **`NotifyPayerReceivableConfirmedInput`** still imported from `application/payer/ports/` — `modules/payer` does not exist until Phase 4.
- Stellar/Etherfuse providers still import from `integrations/*` until Phases 5–6 as specified.
