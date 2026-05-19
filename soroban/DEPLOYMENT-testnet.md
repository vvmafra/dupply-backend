# Deploy log — Stellar Testnet (`duplicata-registry`)

Each `stellar contract deploy` creates a **new** contract address (`C...`). Update this table after each deploy.

| Date | Contract ID | Wasm hash | Deploy tx | `initialize` | `set_issuer_allowed` |
|------|-------------|-----------|-----------|----------------|----------------------|
| 2026-05-15 | `CCX3BC6KKA2GLWJT5HQ5J5DPLRYSCUNPS6DXISJEBYIPWHEJTJBYFRWC` | `aaf657c18b57a4333c2d68f6d1b2008d54c81515093e9040ddf2451f4c6b8fcf` | [tx](https://stellar.expert/explorer/testnet/tx/55634ff3728add5e102525b62945a05af061f1617d1be8c5c87cafe84f1e0b96) | [tx](https://stellar.expert/explorer/testnet/tx/6bee922252e617d7c5770c6927c5083d01271317a4bf37d1e17e99735e95d041) | [tx](https://stellar.expert/explorer/testnet/tx/89c90061f028365d5b2df574db53b67bbc8c55a7a7c2c2a3e3766ccb2edbc08a) |

- **Wasm install (testnet):** [install tx](https://stellar.expert/explorer/testnet/tx/7204d1fce224e1945938a2d53442fd73c77ed2523056795ab46ebd8646f093a3)
- **Lab (contract):** [lab.stellar.org](https://lab.stellar.org/r/testnet/contract/CCX3BC6KKA2GLWJT5HQ5J5DPLRYSCUNPS6DXISJEBYIPWHEJTJBYFRWC)
- **CLI alias:** `dupply-duplicata-registry` → points at the contract ID above (replaces the previous deploy).

**Reference Wasm (local build):** `target/wasm32v1-none/release/duplicata_registry.wasm`

**Commands (summary):** see [README.md](./README.md).

Domain specification and conventions live in the crate **README**; `src/` avoids heavy inline `///` docs.

**Note:** After the English refactor, **redeploy** to pick up `TradeBillRegistry` / `get_trade_bill` / new `IssuePayload` field names; old Wasm is not ABI-compatible.
