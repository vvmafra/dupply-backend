# Validation evidence — Task 7.0: Public HTTP routes — receivables.ts full rewrite

## Changes made

- `src/routes/v1/receivables.ts`: Full rewrite — POST draft, PATCH, submit, risk-decision, seller-decision, GET list/detail; removed `POST .../confirm`.
- Thin error mapping for `ReceivableError`, `SellerError`, `ReceivableTransitionError`.
- `tests/routes/v1/receivables.test.ts`: v2 HTTP flows.

## Test results

```
npm run lint → ✅ 0 errors
npm test → ✅ 182 passing
```

## Success criteria

- [x] Routes delegate to commands/queries — no inline role checks beyond `requireRoles` preHandlers
- [x] `GET /v1/receivables` seller-scoped
- [x] `POST .../confirm` returns 404
- [x] Inactive seller POST → 403 `seller_not_active`
- [x] Full draft patch + submit flow via HTTP

## Notes

Swagger tags/summary/security populated per `routes-swagger.mdc`.
