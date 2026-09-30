# Validation evidence — Task 4.0: Metadata update + submit-for-review

## Changes made

- `src/application/seller/sellerHelpers.ts`: loadSellerOrThrow, parseJson, mapSellerRowToPublicView
- `src/application/seller/commands/updateSellerMetadataCommand.ts`: partial PATCH with toCents
- `src/application/seller/commands/submitSellerForReviewCommand.ts`: completeness + in_review transition
- Application tests for update and submit commands

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 130 passing
```

## Success criteria

- [x] PATCH while created succeeds with money in reais in response
- [x] PATCH while in_review → 409 metadata_locked
- [x] Wrong profileId → 403 forbidden
- [x] Submit with complete metadata → in_review
- [x] Incomplete metadata → 400 incomplete_metadata
- [x] Submit when not created → 409 invalid_status_for_submit

## Notes

None.
