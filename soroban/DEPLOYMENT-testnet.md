# Registo de deploy — Stellar Testnet (`duplicata-registry`)

Cada `stellar contract deploy` gera um **novo** endereço de contrato (`C...`). Atualiza esta tabela após cada deploy.

| Data | Contract ID | Wasm hash | Tx deploy | `initialize` | `set_issuer_allowed` |
|------|-------------|-----------|-----------|----------------|----------------------|
| 2026-05-15 | `CCX3BC6KKA2GLWJT5HQ5J5DPLRYSCUNPS6DXISJEBYIPWHEJTJBYFRWC` | `aaf657c18b57a4333c2d68f6d1b2008d54c81515093e9040ddf2451f4c6b8fcf` | [tx](https://stellar.expert/explorer/testnet/tx/55634ff3728add5e102525b62945a05af061f1617d1be8c5c87cafe84f1e0b96) | [tx](https://stellar.expert/explorer/testnet/tx/6bee922252e617d7c5770c6927c5083d01271317a4bf37d1e17e99735e95d041) | [tx](https://stellar.expert/explorer/testnet/tx/89c90061f028365d5b2df574db53b67bbc8c55a7a7c2c2a3e3766ccb2edbc08a) |

- **Instalação Wasm (testnet):** [tx install](https://stellar.expert/explorer/testnet/tx/7204d1fce224e1945938a2d53442fd73c77ed2523056795ab46ebd8646f093a3)
- **Lab (contrato):** [lab.stellar.org](https://lab.stellar.org/r/testnet/contract/CCX3BC6KKA2GLWJT5HQ5J5DPLRYSCUNPS6DXISJEBYIPWHEJTJBYFRWC)
- **CLI alias:** `dupply-duplicata-registry` → aponta para o contract ID acima (substitui o deploy anterior).

**Wasm de referência (build local):** `target/wasm32v1-none/release/duplicata_registry.wasm`

**Comandos (resumo):** ver [README.md](./README.md).

A especificação de domínio e convenções ficam no **README** do crate; o código em `src/` evita `///` inline.
