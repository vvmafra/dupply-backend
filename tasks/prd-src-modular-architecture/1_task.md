# Task 1.0: Infrastructure foundations

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Establishes the shared `src/infra/` layer and composition root before any product module moves. Moves environment config, database access, generated Soroban bindings, and auth helpers out of legacy top-level paths; creates gateway port interfaces with Stellar/Etherfuse/BlindPay providers and a factory; adds the settlement module placeholder and gateways README. This is Phase 1 of the migration — behavior-preserving path moves and wiring only.

Corresponds to **techspec §2 Infrastructure layout**, **§3 Gateway ports/providers/factories**, **§4 Composition root (partial)**, and **§7 Settlement placeholder**.

Depends on: _none_

## Requirements

- FR-3: Shared technical concerns under `src/infra/` — at minimum `env/`, `database/`, `blockchain/`, `gateways/` (with `ports/`, `providers/`, `factories/`)
- FR-4: Gateway port interfaces so modules depend on abstractions, not vendor SDKs
- FR-9: No database schema semantics change — only TypeScript import path updates; update `drizzle.config.ts` schema paths
- FR-11: Port interfaces for registry (on-chain), ramp/FX, and settlement/PIX (stub)
- FR-14: BlindPay provider reserved under `infra/gateways/providers/blindpay/` with stub implementation
- FR-15: Factory pattern so future chains add code only under `infra/blockchain/{chain}/` and providers
- FR-1 (partial): Create empty `src/modules/settlement/` placeholder with `api/`, `application/`, `domain/` and README
- FR-28: Add `src/infra/gateways/README.md` documenting ports vs providers vs factories
- FR-8: `npm run lint` and `npm test` pass at end of phase

## Subtasks

- [x] 1.1 Read `src/config.ts`, `src/db/**`, `src/lib/**`, `src/generated/**`, and `src/application/deps.ts` to understand current patterns
- [x] 1.2 Move `src/config.ts` → `src/infra/env/config.ts` (optional temporary re-export from old path)
- [x] 1.3 Move `src/db/**` → `src/infra/database/**`; update `drizzle.config.ts` schema paths
- [x] 1.4 Move `src/generated/**` → `src/infra/generated/**`
- [x] 1.5 Move `src/lib/jwt.ts`, `refreshToken.ts`, `authCookie.ts` → `src/infra/auth/**`
- [x] 1.6 Create gateway ports: `registryGateway.ts`, `rampGateway.ts`, `settlementGateway.ts` under `src/infra/gateways/ports/`
- [x] 1.7 Create Stellar registry provider wrapping existing `integrations/registry/*` logic (temporary path until Phase 5)
- [x] 1.8 Create Etherfuse ramp provider wrapping existing `integrations/etherfuse/*`
- [x] 1.9 Create BlindPay settlement stub provider
- [x] 1.10 Create `src/infra/gateways/factories/createGateways.ts`
- [x] 1.11 Move `src/application/deps.ts` → `src/compose/deps.ts`; extend `AppDeps` with `gateways: Gateways`
- [x] 1.12 Create `src/modules/settlement/` placeholder dirs + README
- [x] 1.13 Create `src/infra/gateways/README.md`
- [x] 1.14 Update `src/server.ts` and `src/plugins/**` import paths to new infra locations
- [x] 1.15 Write unit tests for gateway providers (Stellar delegate, Etherfuse mock, BlindPay stub throws)
- [x] 1.16 Verify no TypeScript errors (`npm run lint`) and all tests pass (`npm test`)

## Implementation details

Reference **techspec §2 Infrastructure layout**, **§3 Gateway ports, providers, factories**, **§4 Composition root**, and **§7 Settlement placeholder**.

Key moves:

| Current path | Target path |
| ------------ | ----------- |
| `src/config.ts` | `src/infra/env/config.ts` |
| `src/db/**` | `src/infra/database/**` |
| `src/generated/**` | `src/infra/generated/**` |
| `src/lib/jwt.ts`, `refreshToken.ts`, `authCookie.ts` | `src/infra/auth/**` |

`drizzle.config.ts` update:

```typescript
schema: postgres ? "./src/infra/database/schema.pg.ts" : "./src/infra/database/schema.ts",
```

`AppDeps` extension (from techspec §4):

```typescript
export type AppDeps = {
  db: Db;
  config: AppConfig;
  gateways: Gateways;
  logger?: { warn?: (obj: Record<string, unknown>, msg: string) => void };
  notifyPayerReceivableConfirmed?: (
    deps: AppDeps,
    input: NotifyPayerReceivableConfirmedInput,
  ) => Promise<void>;
};
```

Keep `src/shared/money.ts` at its current location (OQ-1). Keep `src/plugins/` at repo root (OQ-4, FR-6).

Stellar registry provider may temporarily import from `src/integrations/registry/*` until Task 5 consolidates blockchain code under `infra/blockchain/stellar/`.

## Success criteria

- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`)
- [x] `createGateways(config)` returns object implementing all three port interfaces
- [x] BlindPay stub `initiatePixPayment` throws "not implemented"
- [x] `src/compose/deps.ts` exports extended `AppDeps` with `gateways`
- [x] Settlement placeholder module exists with README
- [x] `src/infra/gateways/README.md` documents ports/providers/factories
- [x] No pre-existing tests broken

## Relevant files

- `tasks/prd-src-modular-architecture/prd.md` ← read first
- `tasks/prd-src-modular-architecture/techspec.md` ← read first
- `src/config.ts` ← move
- `src/db/**` ← move
- `src/lib/**` ← move
- `src/generated/**` ← move
- `src/application/deps.ts` ← move to compose
- `src/integrations/registry/**` ← read (wrapped by provider)
- `src/integrations/etherfuse/**` ← read (wrapped by provider)
- `src/infra/**` ← create
- `src/compose/deps.ts` ← create
- `src/modules/settlement/**` ← create placeholder
- `drizzle.config.ts` ← modify
- `src/server.ts` ← modify imports
- `tests/infra/gateways/**` ← create unit tests
