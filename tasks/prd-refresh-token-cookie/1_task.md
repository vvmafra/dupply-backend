# Task 1.0: Register `@fastify/cookie` plugin

<critical>Read prd.md and techspec.md in this folder before starting. Your work will be rejected if you skip this.</critical>

## Overview

Installs `@fastify/cookie` and registers it in the Fastify server before any route that reads or writes cookies. This enables `request.cookies`, `reply.setCookie`, and `reply.clearCookie` across the application.

Corresponds to **techspec § Component 1 — New dependency `@fastify/cookie`**, **techspec § Component 3 — `src/plugins/cookie.ts`**, and **techspec § Component 4 — `src/server.ts`**.

Depends on: _none_

## Requirements

- FR-8: The `@fastify/cookie` plugin must be registered in the server before any route that reads or writes cookies
- Techspec: No cookie signing secret needed — the cookie value is a random token already hashed server-side

## Subtasks

- [ ] 1.1 Read `src/server.ts` to understand existing plugin registration order
- [ ] 1.2 Run `npm install @fastify/cookie` to add the dependency
- [ ] 1.3 Create `src/plugins/cookie.ts` with `registerCookie`
- [ ] 1.4 Register `registerCookie(app)` in `src/server.ts` immediately after serializer/validator setup and before CORS and routes
- [ ] 1.5 Verify no TypeScript errors (`npm run lint`)

## Implementation details

Reference **techspec § "1. New dependency — @fastify/cookie"**, **§ "3. New file — src/plugins/cookie.ts"**, and **§ "4. Modified — src/server.ts"**.

Plugin file:

```typescript
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

export async function registerCookie(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
}
```

Registration order in `server.ts`:

```typescript
// after app.setSerializerCompiler(...)
await registerCookie(app);
await registerCors(app, config);
```

Do not configure a signing secret — plain token transport only.

## Success criteria

- [ ] Code compiles (`npm run lint` passes)
- [ ] `@fastify/cookie` appears in `package.json` dependencies
- [ ] `src/plugins/cookie.ts` exports `registerCookie`
- [ ] Cookie plugin is registered before CORS and route plugins in `src/server.ts`
- [ ] No pre-existing tests broken

## Relevant files

- `tasks/prd-refresh-token-cookie/prd.md` ← read first
- `tasks/prd-refresh-token-cookie/techspec.md` ← read first
- `package.json` ← modify
- `src/plugins/cookie.ts` ← create
- `src/server.ts` ← modify
