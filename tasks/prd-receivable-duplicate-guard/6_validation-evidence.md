# Validation evidence — Task 6.0: Wire guard into update/submit commands

## Changes made

- `src/application/receivable/commands/updateReceivableDraftCommand.ts`: guard on metadata patch, materialized columns, DB violation mapping
- `src/application/receivable/commands/submitReceivableCommand.ts`: guard before transition (exclude self)
- Extended update/submit command tests

## Test results

```
npm test → ✅ 274 passing
```

## Success criteria

- [x] PATCH bill change collision → duplicate error
- [x] PATCH value-only → no duplicate guard failure
- [x] Submit collision → duplicate error (via metadata JSON setup simulating pre-submit state)
- [x] Self excluded on update/submit

## Notes

Submit duplicate integration test sets colliding metadata JSON directly (without updating materialized columns) to exercise the submit guard without violating the partial unique index on concurrent `created` rows.
