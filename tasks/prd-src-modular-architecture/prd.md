# Product Requirements Document — Source Modular Architecture (Vertical Modules + Shared Infra)

## Overview

The Dupply backend (`src/`) currently uses **horizontal layers** (`domain/`, `application/`, `routes/`, `integrations/`) with **mirrored folder names** across layers (e.g. `domain/wallet/` and `application/wallet/`). This layout made early delivery fast but is now hard to navigate: understanding one capability requires jumping across multiple top-level trees, and chain/vendor code is not clearly separated from product modules.

This initiative **reorganizes `src/` only** — no product behavior change, no public API change — into:

1. **`modules/`** — vertical slices by bounded context (auth, wallet, receivable, registry, settlement, etc.), each containing its own `api/`, `application/`, and `domain/` subfolders.
2. **`infra/`** — shared technical infrastructure (environment config, database access, blockchain adapters, external gateways) so that Stellar, BlindPay, Etherfuse, and future chains/providers live outside product modules.

The goal is to improve developer velocity, prepare for multi-chain integration without rewriting product logic, and establish a **single authoritative architecture** that all future work (human and agent) must follow. Existing business rules, tests, Drizzle schema, and Soroban contracts are preserved; only structure, imports, and documentation/governance artifacts are updated.

## Goals

- Make every bounded context discoverable in **one module folder** instead of three or four scattered locations.
- Isolate all external systems (Stellar/Soroban, PIX providers, ramp providers, DB) under **`infra/`**, with explicit gateway ports and swappable providers.
- Preserve **100% of existing `/v1/*` HTTP contracts** and passing tests throughout the migration.
- Update **all affected agent rules and skills** so new code cannot regress to the old horizontal layout.
- Keep Stellar as the only implemented ledger for now; structure must support adding another chain later via `infra/` only.

**Success metrics:**

- A developer can locate all wallet-related code under `src/modules/wallet/` without opening `domain/`, `application/`, and `routes/` at the repo root.
- Zero change in published OpenAPI paths, request/response shapes, and HTTP status semantics for existing routes.
- `npm run lint` and `npm test` pass after each migration phase and at project completion.
- `docs/ARCHITECTURE-RULES.md`, `AGENTS.md`, and every affected `.cursor/rules/*.mdc` file describe the new layout; agent skills reference the new paths in their mandatory read steps.
- No new Stellar/Base/Solana product feature ships as part of this initiative — structure only.

## User Stories

- As a **backend developer**, I want each product capability in one module folder so that I can onboard and change features without hunting across the repo.
- As a **backend developer**, I want blockchain and PIX/ramp integrations centralized in `infra/` so that adding a new chain or provider does not require renaming product modules.
- As a **tech lead**, I want architecture rules and agent skills updated in the same initiative so that AI-assisted and human contributions follow one standard.
- As the **system**, I want import boundaries enforced by documented rules so that product modules do not import vendor SDKs directly.

**Main flow (migration, not runtime):**

1. Team agrees on target layout (this PRD) and detailed file mapping (Tech Spec).
2. Shared `infra/` foundations move first (env, database, blockchain Stellar adapter, gateway ports/providers).
3. One pilot module (auth) is moved to validate the pattern and Fastify registration approach.
4. Remaining modules migrate incrementally; tests and lint run after each phase.
5. Legacy top-level folders (`src/domain`, `src/application`, `src/routes/v1` flat imports, `src/integrations`) are removed only when empty.
6. Rules, skills, and architecture docs are updated before the initiative is marked complete.

## Core Features

1. **Vertical product modules**
   - What it does: Groups each bounded context under `src/modules/{name}/` with `api/`, `application/`, and `domain/` inside the module.
   - Why it matters: Eliminates the cognitive overhead of duplicated top-level folder names and aligns folder structure with how the team thinks about the product.

2. **Shared infrastructure layer**
   - What it does: Centralizes environment loading, database/Drizzle access, blockchain adapters, and external gateway clients under `src/infra/`.
   - Why it matters: Chain-specific and vendor-specific code stays out of product modules; future multi-chain support is an infra change, not a product rewrite.

3. **Gateway abstraction (ports / providers / factories)**
   - What it does: Defines stable interfaces in `infra/gateways/ports/` for registry, PIX/settlement, and ramp; implements Stellar/BlindPay/Etherfuse in `providers/`; selects implementation via `factories/` and config.
   - Why it matters: Dupply stays Stellar-first while avoiding hard coupling in module application code.

4. **Fastify module registration (no NestJS)**
   - What it does: Each module exposes a single registration entry (e.g. `registerWalletModule(app, deps)`) wired from `server.ts`.
   - Why it matters: Achieves the same modularity as the reference diagram without introducing a new framework.

5. **Governance sync (rules + skills + docs)**
   - What it does: Updates architecture documentation, Cursor rules, and agent skills so all future PRDs, tech specs, and task execution follow the new paths and import matrix.
   - Why it matters: Prevents the codebase from drifting back to the old layout on the next feature.

## Functional Requirements

### Structure and boundaries

1. **FR-1:** All product bounded contexts must live under `src/modules/{module}/`, including at minimum: `auth`, `account`, `seller`, `wallet`, `receivable`, `payer`, `registry` (on-chain trade bill flow), `ramp`, and `settlement` (PIX — folder may start empty until POC integration lands).
2. **FR-2:** Each module must contain `api/`, `application/`, and `domain/` subfolders. HTTP handlers live in `api/`; use cases in `application/`; pure rules and types in `domain/`.
3. **FR-3:** Shared technical concerns must live under `src/infra/`, including at minimum: `env/`, `database/`, `blockchain/`, and `gateways/` (with `ports/`, `providers/`, and `factories/` subfolders).
4. **FR-4:** Product modules must not import vendor SDKs (e.g. `@stellar/stellar-sdk`, Etherfuse HTTP client, BlindPay client) directly. They must depend on interfaces wired through `infra/gateways/ports/` or module-local application dependencies injected via the composition root.
5. **FR-5:** Cross-module communication must use explicit IDs and application-level orchestration — not direct imports of another module's `domain/` or `infra/` internals, except shared types exported intentionally from a module's public surface (to be defined in Tech Spec).
6. **FR-6:** Global HTTP cross-cutting plugins (JWT, CORS, Swagger, API key) may remain at `src/plugins/` or move to `src/infra/http/` — exact placement is defined in Tech Spec; they must not contain business rules.

### Runtime and compatibility

7. **FR-7:** All existing public routes under `/v1/*` must remain registered with the same paths, methods, auth guards, and response contracts after migration.
8. **FR-8:** `npm run lint` and `npm test` must pass at the end of each migration phase defined in the Tech Spec.
9. **FR-9:** No new database tables or columns are required for this initiative unless the Tech Spec identifies a minimal rename (e.g. config keys); schema behavior must remain unchanged.
10. **FR-10:** Soroban contract code under `soroban/` is out of scope for folder moves; only TypeScript integration paths in `src/` change.

### Gateway and multi-chain readiness

11. **FR-11:** Gateway port interfaces must exist for: on-chain registry operations, PIX/settlement rails, and ramp/FX — even if some implementations remain stubs until later features.
12. **FR-12:** Stellar/Soroban registry and network code currently under `src/integrations/registry/` and related paths must consolidate under `infra/blockchain/stellar/` (or equivalent path defined in Tech Spec).
13. **FR-13:** Etherfuse ramp client must consolidate under `infra/gateways/providers/etherfuse/` (or equivalent).
14. **FR-14:** BlindPay PIX provider placement must be reserved under `infra/gateways/providers/blindpay/`; implementation may follow the settlement module POC — no PIX behavior change required to complete this PRD.
15. **FR-15:** Adding a second blockchain in the future must require new code only under `infra/blockchain/{chain}/` and gateway providers/factories — not new top-level `src/domain` or `src/application` trees.

### Migration process

16. **FR-16:** Migration must be **incremental** — at least one module moved and verified before bulk moves; no single big-bang commit that breaks the main branch without a rollback plan.
17. **FR-17:** Legacy paths (`src/domain/`, `src/application/`, `src/routes/`, `src/integrations/`) must be deleted only after all imports and tests no longer reference them.
18. **FR-18:** Import paths in tests under `tests/` must be updated to match the new structure as part of each phase.

### Documentation and agent governance

19. **FR-19:** `docs/ARCHITECTURE-RULES.md` must be rewritten to describe the modular layout, import matrix, and CQRS conventions within modules (replacing horizontal-layer path examples).
20. **FR-20:** `AGENTS.md` context routing table must map each bounded context to `src/modules/{name}/` and `src/infra/` paths instead of legacy locations.
21. **FR-21:** `.cursor/rules/project-context.mdc` must reflect the new stack layout (modules + infra) and remove references to top-level `src/domain/` and `src/application/` as the canonical pattern.
22. **FR-22:** `.cursor/rules/architecture-layers.mdc` must be renamed or rewritten as the authoritative **modular architecture** rule (layer rules apply **inside** each module, plus infra boundaries).
23. **FR-23:** Every module-specific rule file (e.g. `module-wallet.mdc`, `module-receivables.mdc`, `module-registry.mdc`, `module-ramp.mdc`, `module-account.mdc`, `module-seller.mdc`, `module-payer.mdc`) must update `globs` and path references to the new module locations.
24. **FR-24:** `.cursor/rules/routes-swagger.mdc` and `.cursor/rules/testing.mdc` must be reviewed and updated if they reference legacy route or test paths.
25. **FR-25:** Agent skill `.cursor/skills/write-prd/SKILL.md` must require reading the updated architecture rule and use `src/modules/` examples in its gather-context step.
26. **FR-26:** Agent skill `.cursor/skills/write-techspec/SKILL.md` must require exploring `src/modules/{context}/` and `src/infra/` instead of flat `src/domain/` and `src/integrations/`.
27. **FR-27:** Agent skill `.cursor/skills/create-tasks/SKILL.md` and `.cursor/skills/execute-task/SKILL.md` must reference the modular architecture rule in their mandatory follow steps.
28. **FR-28:** A short `src/infra/gateways/README.md` must document ports vs providers vs factories and where to add a new chain or vendor (human-facing; English).

## Technical Constraints

- Scope: **`src/` TypeScript reorganization** plus documentation, Cursor rules, and agent skills listed in FR-19–FR-28. No frontend changes.
- Framework remains **Fastify 5** — do not adopt NestJS modules or decorators as part of this initiative.
- Public HTTP API contract on `/v1/*` is frozen; internal file layout only.
- Business logic must not be rewritten for optimization — moves and import fixes only, except where legacy route handlers must be extracted into module `application/` commands (behavior-preserving refactors).
- Composition root (today `application/deps.ts`) must evolve to inject gateway ports; exact file location defined in Tech Spec.
- English for all updated rules, skills, architecture docs, and task artifacts.

## Out of Scope

- New product features (receivable workflows, PIX production flows, wallet passkey changes, registry behavior changes).
- Implementing a second blockchain (Base, Solana, XRPL, Starknet) — only structural readiness.
- Rewriting the Soroban Rust contract or redeploying registry Wasm.
- Changing Drizzle schema semantics or migration history (renames of tables/columns).
- Renaming public HTTP resource paths (e.g. `/v1/trade-bills` → `/v1/registry`) — URL stability is required.
- Frontend or `smart-account-kit` SDK changes.
- CI pipeline redesign beyond fixing paths if tests reference old directories.

## Open Questions

- **OQ-1:** Should `shared/` (e.g. `money.ts`) remain at `src/shared/` or move to `src/infra/shared/` or `src/modules/_shared/`? — **Owner: tech lead** (decide in Tech Spec).
- **OQ-2:** Should legacy `tradeBill` naming in domain types become `registry` during the move, or only folder paths change first? — **Owner: tech lead** (prefer minimal rename in PRD phase; Tech Spec decides).
- **OQ-3:** Pilot module order: auth-only first vs auth + wallet together? — **Owner: implementing developer** (Tech Spec proposes phased task list).
- **OQ-4:** Keep `src/plugins/` at root vs nest under `src/infra/http/`? — **Owner: tech lead** (Tech Spec).
- **OQ-5:** When to introduce `settlement` module code vs empty placeholder during infra gateway setup? — **Owner: tech lead** (aligned with BlindPay POC timeline).
