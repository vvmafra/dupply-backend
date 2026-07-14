# Validation evidence — Task 8.0: Governance sync — docs, rules, and agent skills

## Changes made

- `docs/ARCHITECTURE-RULES.md`: full rewrite for modular layout (`modules/` + `infra/`), import matrix from techspec, CQRS inside modules, resolved OQ-1/OQ-2/OQ-4 placement decisions; removed legacy horizontal-layer paths as canonical
- `AGENTS.md`: context routing table → `src/modules/{name}/` and `src/infra/`; rules/skills index and quick rules updated
- `.cursor/rules/project-context.mdc`: canonical layout table; bounded contexts use module/infra paths; schema path → `infra/database`
- `.cursor/rules/architecture-layers.mdc`: rewritten as modular architecture rule (layers inside modules + infra/gateway boundaries)
- `.cursor/rules/module-account.mdc`, `module-wallet.mdc`, `module-seller.mdc`, `module-payer.mdc`, `module-receivables.mdc`, `module-registry.mdc`, `module-ramp.mdc`: `globs` → `src/modules/{name}/**` (+ auth for account); path references updated
- `.cursor/rules/routes-swagger.mdc`: globs → `src/modules/**/api/**`; examples use `registerXxxModule` + `AppDeps`
- `.cursor/rules/testing.mdc`: mirror layout under `tests/modules/{context}/`
- `.cursor/skills/write-prd/SKILL.md`, `write-techspec/SKILL.md`, `create-tasks/SKILL.md`, `execute-task/SKILL.md`: require reading modular `ARCHITECTURE-RULES.md`; explore/implement under `src/modules/` and `src/infra/`
- `src/infra/gateways/README.md`: verified complete (ports / providers / factories; how to add chain or vendor) — no change required

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 295 passing
```

## Success criteria

- [x] `docs/ARCHITECTURE-RULES.md` describes modular layout with import matrix — no legacy horizontal-layer examples as canonical — verified by rewrite
- [x] `AGENTS.md` routes each bounded context to `src/modules/{name}/` — verified
- [x] All module rule `globs` match new paths — verified for the seven modules listed in FR-23
- [x] Agent skills require reading modular architecture rule before PRD/techspec/task work — verified
- [x] `src/infra/gateways/README.md` documents how to add a new chain or vendor — verified (already complete from Task 1)
- [x] Code compiles (`npm run lint` passes)
- [x] Unit tests pass (`npm test`) — 295/295
- [x] No pre-existing tests broken

## Notes

- Doc/rule/skill-only change; no runtime code edits.
- Out of FR-23 scope but still on legacy globs: `module-documents.mdc`, `module-risk-analyst.mdc`, and `data-models-relationships.mdc` (`src/db/**`). Noted for a follow-up if those rules should auto-attach under the new tree.
- English used for all updated architecture docs, rules, and skills content that was rewritten; existing Portuguese body text in some module rules was left intact except where path strings needed updates.
