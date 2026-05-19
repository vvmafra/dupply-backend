# English as the project language

**Date:** 2026-05-18  
**Scope:** `dupply-backend` — HTTP API, Soroban contract (`TradeBillRegistry`), generated TS bindings, Drizzle schema/migrations, and technical documentation under `docs/`.

## What changed

- Contract: Portuguese-derived domain identifiers replaced with English (`BillKind`, `TradeBill`, `get_trade_bill`, English `IssuePayload` fields, event `TradeBillIssued`).
- HTTP: `/v1/trade-bills` routes; request/response fields use English camelCase (see `API.md` and `src/domain/tradeBill/dto.ts`).
- Database: tables `trade_bill_drafts` / `trade_bill_chain_records` (migration `0002_rename_trade_bills.sql` renames legacy `duplicata_*` tables).
- Bindings: regenerate `src/generated/trade-bill-registry-contract.ts` from Wasm (see `API.md`).

## Official references

- Stellar Soroban — [Smart contracts](https://developers.stellar.org/docs/build/smart-contracts)  
- Stellar CLI / bindings — [Developer tools](https://developers.stellar.org/docs/tools/developer-tools/stellar-cli)  

## Rollback

`git revert` the migration and code commits; restore a previous Wasm deployment ID if already on testnet.
