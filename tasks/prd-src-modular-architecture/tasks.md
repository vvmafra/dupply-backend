# Tasks — Source Modular Architecture (Vertical Modules + Shared Infra)

## Tasks

- [x] 1.0 Infrastructure foundations — move config/db/generated/auth to `infra/`, gateway ports/providers/factories, composition root, settlement placeholder
- [x] 2.0 Pilot modules — auth + account vertical slices, `registerModules.ts` scaffold, thin `server.ts`
- [x] 3.0 Seller + wallet modules — full vertical slices, route registration, test path updates
- [x] 4.0 Payer + receivable modules — full vertical slices, cross-module callback wiring in compose
- [x] 5.0 Registry module — move trade-bill slice, consolidate Stellar/Soroban under `infra/blockchain/stellar/`, refactor routes to `RegistryGateway`
- [x] 6.0 Ramp module — move ramp slice, Etherfuse to providers, wire `RampGateway`, webhook route
- [x] 7.0 Legacy cleanup — remove empty horizontal-layer directories, update script import paths
- [x] 8.0 Governance sync — architecture docs, Cursor rules, and agent skills (FR-19–FR-28)
