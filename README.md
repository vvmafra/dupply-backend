# dupply-backend

Dupply Backend: **duplicata-registry** Soroban contract and **indexer** skeleton.

## Soroban Contract (`duplicata-registry`)

Location: [contracts/duplicata-registry/](contracts/duplicata-registry/)

```bash
cd contracts/duplicata-registry
cargo test -p duplicata-registry
stellar contract build
```

- **Rust:** see [contracts/duplicata-registry/rust-toolchain.toml](contracts/duplicata-registry/rust-toolchain.toml) (currently `1.92.0` as required by the `stellar contract build` CLI).
- **Wasm:** `contracts/duplicata-registry/target/wasm32v1-none/release/duplicata_registry.wasm`
- **Deploy to testnet (optional):** [contracts/duplicata-registry/scripts/deploy-testnet.sh](contracts/duplicata-registry/scripts/deploy-testnet.sh) — requires `STELLAR_IDENTITY` and the Wasm already compiled.

Product/spec documentation (Markdown in the frontend repo, only as reference): `dupply-frontend/docs/notes/2026-05-15_stellar-duplicata-master-implementation-guide.md`.

## Indexer (MVP)

See [indexer/README.md](indexer/README.md) and `indexer/src/index.js`.

## Notes

- The **frontend** (`dupply-frontend`) is not part of these changes.
- **No** `git push` was executed to remote as part of this delivery.
