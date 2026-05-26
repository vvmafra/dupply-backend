# Task 2.0: Enable CORS credentials

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Adds `credentials: true` to the CORS plugin so the browser forwards the `dupply_rt` cookie on cross-origin requests when the frontend uses `credentials: "include"`. The existing origin allowlist remains unchanged — wildcard `*` is incompatible with credentials and must not be introduced.

Corresponds to **techspec § Component 5 — Modified `src/plugins/cors.ts`**.

Depends on: _none_

## Requirements

- FR-9: The CORS plugin must be updated to include `credentials: true` so the browser forwards cookies on cross-origin requests to the allowed origins
- PRD technical constraint: CORS change must be combined with explicit origin allowlist — wildcard `*` origin is incompatible with `credentials: true`

## Subtasks

- [ ] 2.1 Read `src/plugins/cors.ts` to understand the existing origin allowlist logic
- [ ] 2.2 Add `credentials: true` to the `cors` registration options
- [ ] 2.3 Confirm the origin callback still rejects disallowed origins (no wildcard)
- [ ] 2.4 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "5. Modified — src/plugins/cors.ts"**.

```typescript
await app.register(cors, {
  origin: (origin, callback) => { ... }, // unchanged
  credentials: true,                      // ← new
  methods: [...],
  allowedHeaders: [...],
});
```

Only add `credentials: true`. Do not change the origin allowlist logic.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] `credentials: true` is present in `src/plugins/cors.ts`
- [ ] Origin allowlist logic is unchanged (no wildcard origin)
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-refresh-token-cookie/prd.md` ← read first
- `tasks/prd-refresh-token-cookie/techspec.md` ← read first
- `src/plugins/cors.ts` ← modify
