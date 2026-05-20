# Indexer (not implemented)

There is **no runnable indexer package** in this repository yet. The previous stub only validated `SOROBAN_RPC_URL` and `DUPPLY_REGISTRY_CONTRACT_ID` and exited.

Planned work (when needed):

- Subscribe to Soroban / Horizon events for `TradeBillIssued` from the registry contract.
- Persist cursors and normalized events (idempotency key: e.g. `ledger`, `tx_hash`, `event_index`).
- Either share the API SQLite/Postgres via a small library or write through an internal HTTP boundary.

Until then, use the HTTP API and on-chain reads (`GET /v1/trade-bills/...`) for MVP flows. See [API.md](../API.md) and [docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md](../docs/notes/2026-05-18_v1-duplicata-contract-integration-architecture.md).
