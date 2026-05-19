# Notes: Dupply API stack (`src/`)

**Date:** 2026-05-17  
**Goal:** Record decisions from the first executable implementation of the plan [2026-05-16_dupply-backend-v1-plan.md](2026-05-16_dupply-backend-v1-plan.md).

## Decisions

| Area | Choice | Rationale |
|------|--------|-----------|
| Framework | Fastify 5 | Lightweight, schema-friendly, built-in logging |
| Language | TypeScript (ESM, `NodeNext`) | Maintainability and Zod typing |
| Persistence (dev) | SQLite + Drizzle ORM | Zero local infra; versioned migrations in `drizzle/` |
| Ramp | Etherfuse HTTP client | Official docs [docs.etherfuse.com](https://docs.etherfuse.com/overview); auth **without** `Bearer` prefix |
| Trade bills | Generated `@stellar/stellar-sdk` contract client (`stellar contract bindings`) | `simulate` + `toXDR()` for issuer signing; confirmation via `getTransaction` |
| API auth | Header `X-Dupply-Api-Key` | Avoids semantic clash with `Authorization` used by Etherfuse |
| Webhook | `canonicalize` + HMAC-SHA256 | Per [Verifying Webhooks](https://docs.etherfuse.com/guides/verifying-webhooks); CJS `require` for TS type interoperability |

## Rollback

Removing or disabling the HTTP API does not affect the contract or indexer; the database is a local file (`DATABASE_URL`).

## Suggested next steps

- PostgreSQL in staging/production (same Drizzle schema, `postgresql` dialect).  
- Optionally refresh Etherfuse state on `GET /v1/ramp/orders/:id` (list/detail endpoint when integrated).  
- Queue (BullMQ) for webhook retries and reconciliation.
