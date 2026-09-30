# Validation evidence — Task 3.0: Register command + profileId resolution

## Changes made

- `src/application/seller/commands/registerSellerCommand.ts`: atomic account + seller creation (sync SQLite transaction)
- `src/domain/account/profileId.ts`: `resolveProfileId` queries sellers for seller role
- `src/application/account/commands/loginCommands.ts`: uses real profileId via `resolveProfileId`
- `tests/application/seller/registerSellerCommand.test.ts`: atomic create + duplicate email rollback
- Updated auth route tests for seller profileId

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 130 passing
```

## Success criteria

- [x] Atomic account + seller creation
- [x] Duplicate email rolls back both rows
- [x] JWT profileId equals seller.id after login
- [x] Existing login/refresh tests pass
- [x] No pre-existing tests broken

## Notes

SQLite requires synchronous `.run()` inside `db.transaction()` — async transaction callbacks are not supported by better-sqlite3.
