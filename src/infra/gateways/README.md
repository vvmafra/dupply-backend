# Gateways — ports, providers, factories

External systems (Stellar/Soroban, Etherfuse ramp, BlindPay PIX) are accessed only through this package. Product modules depend on **ports**, never on vendor SDKs.

## Layout

| Folder | Role |
| ------ | ---- |
| `ports/` | Stable TypeScript interfaces (`RegistryGateway`, `RampGateway`, `SettlementGateway`) |
| `providers/` | Vendor implementations (Stellar, Etherfuse, BlindPay stub) |
| `factories/` | `createGateways(config)` selects providers and returns a `Gateways` object |

## How modules use gateways

1. Application code receives `deps.gateways` from `AppDeps` (`src/compose/deps.ts`).
2. Call `deps.gateways.registry.simulateIssue(...)`, `deps.gateways.ramp.getAssets(...)`, etc.
3. Do **not** import `@stellar/stellar-sdk`, Etherfuse HTTP clients, or BlindPay SDKs from `modules/`.

## Adding a new blockchain

1. Add adapters under `src/infra/blockchain/{chain}/`.
2. Add a provider under `src/infra/gateways/providers/{chain}/` implementing the relevant port(s).
3. Branch in `factories/createGateways.ts` (or add a config-driven selector).
4. No new top-level `src/domain/` or `src/application/` trees — product modules stay unchanged.

## Adding a new vendor (ramp / settlement)

1. Implement the port under `providers/{vendor}/`.
2. Wire it in `createGateways` (config flag or default).
3. Keep the port interface stable; extend it only when all providers can support the change.

## Current providers

| Port | Provider | Notes |
| ---- | -------- | ----- |
| `registry` | Stellar (`providers/stellar/`) | Wraps `infra/blockchain/stellar/registry/*` |
| `ramp` | Etherfuse (`providers/etherfuse/`) | Client + webhook verify under `providers/etherfuse/` |
| `settlement` | BlindPay stub (`providers/blindpay/`) | Throws “not implemented” until settlement POC |
