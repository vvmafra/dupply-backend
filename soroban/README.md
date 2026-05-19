# Dupply — `duplicata-registry` (Soroban)

On-chain **trade bill** registry: **issuer allowlist**, **`issue`** with `BytesN<32>` commitments, amounts in **cents (`i128`)**, and **`TradeBillIssued`** event ([`contractevent`](https://developers.stellar.org/docs/build/smart-contracts/getting-started/events)).

Rust sources in `crates/duplicata-registry/src/` use minimal inline `///` docs; the API and domain are described here and in [DEPLOYMENT-testnet.md](./DEPLOYMENT-testnet.md).

## Toolchain

- **Rust:** `1.92.0` (pinned in [rust-toolchain.toml](rust-toolchain.toml)). `stellar contract build` **rejects** 1.91.0; see CLI output if you change the version.
- **Target:** `wasm32v1-none`
- **soroban-sdk:** workspace `25` (see [Cargo.toml](Cargo.toml))

## Commands

From this Soroban workspace root (`dupply-backend/soroban`):

```bash
cargo test -p duplicata-registry
stellar contract build
```

Release Wasm: `target/wasm32v1-none/release/duplicata_registry.wasm`

## Contract API

| Function | Description |
| -------- | ----------- |
| `initialize(admin)` | Once; `admin` signs. |
| `set_admin(new_admin)` | Current `admin` only. |
| `set_issuer_allowed(issuer, allowed)` | `admin` only. |
| `issue(issuer, payload)` | Signed issuer + allowlist + invariants. Returns `id` (`u64`). |
| `get_trade_bill(id)` | Read. |
| `is_issuer_allowed(issuer)` | Read. |
| `admin()` / `next_id()` | Read. |

### Errors (`RegistryError`)

`AlreadyInitialized`, `NotInitialized`, `Unauthorized` (via auth), `IssuerNotAllowed`, `InvalidAmounts`, `InvalidDates`, `FraudDeclarationsRequired`, `NotFound`, `InvalidDiscountFlags`.

### `issue` invariants

- `fraud_declarations_accepted == true`
- `face_value_cents > 0`
- `0 <= max_advance_value_cents <= face_value_cents`
- `due_date_unix > issue_date_unix`
- If `discount_eligible`: `fiscal_doc_attached && evidence_attached`

## Deploy (testnet)

Do not commit keys. Example (adjust identity / network per [Stellar docs](https://developers.stellar.org/docs/build/smart-contracts/getting-started/deploy-to-testnet)):

```bash
stellar contract deploy   --wasm target/wasm32v1-none/release/duplicata_registry.wasm   --source SAUA...   --network testnet
```

Optional script: [scripts/deploy-testnet.sh](scripts/deploy-testnet.sh)

## Frontend types

Align HTTP/JSON with the Dupply frontend where applicable (`duplicata.types.ts` or successor); contract + generated TS bindings are the on-chain source of truth until a shared package exists.

## Layout

```text
soroban/
  Cargo.toml                    # workspace (members: crates/*)
  rust-toolchain.toml
  crates/duplicata-registry/
    Cargo.toml
    Makefile
    src/
      lib.rs                     # TradeBillRegistry
      types.rs
      error.rs
      test.rs
  scripts/
```
