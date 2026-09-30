# Validation evidence — Task 5.0: Status transition + soft delete

## Changes made

- `src/application/seller/commands/transitionSellerStatusCommand.ts`: approve/reject/deactivate/reactivate + wallet @todo
- `src/application/seller/commands/softDeleteSellerCommand.ts`: admin soft delete
- Application tests for both commands

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 130 passing
```

## Success criteria

- [x] All four valid transitions work for admin
- [x] risk_analyst → 403 in v1
- [x] Non-admin → 403
- [x] created → active → 409 invalid_status_transition
- [x] Soft delete sets deletedAt; idempotent on re-delete
- [x] No pre-existing tests broken

## Notes

Removed async transaction wrapper for status update (single UPDATE; wallet hook deferred). SQLite async transactions are incompatible with better-sqlite3.
