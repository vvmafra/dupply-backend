# Validation evidence — Task 4.0: Payer + receivable modules

## Changes made

- `src/modules/payer/domain/**`: moved from `src/domain/payer/**` (errors); temporary re-export at old path
- `src/modules/payer/application/**`: moved commands (`upsertPayerByCnpj`) and ports (`receivableNotification`, `magicLinkToken`); temporary re-exports at old paths
- `src/modules/payer/api/payers.ts` + `registerPayerModule.ts`: moved payer HTTP handlers; registrar wraps routes
- `src/modules/receivable/domain/**`: moved from `src/domain/receivable/**` (types, errors, policies, transitions, metadata, businessKey); temporary re-exports at old paths
- `src/modules/receivable/application/**`: moved commands, queries, `duplicateGuard`, `receivableHelpers`; temporary re-exports at old paths
- `src/modules/receivable/api/receivables.ts`, `receivable-internal.ts` + `registerReceivableModule.ts`, `registerReceivableInternalModule.ts`: moved both API entry points with registrars
- `src/compose/deps.ts`: import type from payer module; added `createAppDeps()` that wires default `notifyPayerReceivableConfirmed` stub at composition root
- `src/server.ts`: uses `createAppDeps()` so production always gets the payer notification callback
- `src/modules/receivable/application/commands/sellerDecisionCommand.ts`: uses only `deps.notifyPayerReceivableConfirmed` (no direct payer module import)
- `src/compose/registerModules.ts`: public scope → `registerPayerModule`; JWT scope → `registerReceivableModule`; API-key scope → `registerReceivableInternalModule`
- `src/routes/v1/payers.ts`, `receivables.ts`, `receivable-internal.ts`: temporary re-exports to new module api paths
- `tests/modules/payer/**`, `tests/modules/receivable/**`: moved from `tests/application` / `tests/domain` with updated imports
- `tests/routes/v1/receivables.test.ts`, `receivable-internal.test.ts`, `payers.test.ts`: import routes from modules
- `tests/helpers/receivableTestHelpers.ts`: uses `createAppDeps` so default notify wiring matches production

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 288 passing
```

## Success criteria

- [x] Code compiles (`npm run lint` passes) — verified
- [x] Unit tests pass (`npm test`) — 288/288
- [x] Receivable routes (`/v1/receivables/*`) behave identically — `receivables.test.ts` green
- [x] Payer magic-link routes behave identically — `payers.test.ts` green
- [x] Internal receivable routes (API-key protected) behave identically — `receivable-internal.test.ts` green
- [x] `notifyPayerReceivableConfirmed` wired through compose (`createAppDeps`), not cross-module domain imports — `sellerDecisionCommand` only reads `deps.notifyPayerReceivableConfirmed`
- [x] No pre-existing tests broken — all prior suites still pass

## Notes

- **Temporary re-exports** left at legacy payer/receivable paths until Phase 8 cleanup (same pattern as Tasks 1–3).
- **Cross-module application imports preserved** (behavior-preserving, same as Task 3): receivable create flows still call `upsertPayerByCnpj`; payer upsert still uses `findPayerByCnpj` from receivable helpers. Forbidden domain→domain cross-imports avoided; notification uses composition-root callback only.
- **`createAppDeps`** introduced so tests and server share the same default wiring for `notifyPayerReceivableConfirmed` without receivable importing the payer port.
- **`registerPayerModule` / `registerReceivableModule` / `registerReceivableInternalModule`** call route registrars without an extra nested `app.register` — scope grouping lives in `registerModules.ts` to match former hook order.
