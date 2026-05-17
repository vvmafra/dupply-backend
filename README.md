# dupply-backend

Backend Dupply: contrato Soroban **duplicata-registry** e esqueleto de **indexador**.

## Contrato Soroban (`duplicata-registry`)

Local: [contracts/duplicata-registry/](contracts/duplicata-registry/)

```bash
cd contracts/duplicata-registry
cargo test -p duplicata-registry
stellar contract build
```

- **Rust:** ver [contracts/duplicata-registry/rust-toolchain.toml](contracts/duplicata-registry/rust-toolchain.toml) (atualmente `1.92.0` por requisito da CLI `stellar contract build`).
- **Wasm:** `contracts/duplicata-registry/target/wasm32v1-none/release/duplicata_registry.wasm`
- **Deploy testnet (opcional):** [contracts/duplicata-registry/scripts/deploy-testnet.sh](contracts/duplicata-registry/scripts/deploy-testnet.sh) — requer `STELLAR_IDENTITY` e Wasm já compilado.

Documentação de produto/spec (Markdown no repo do front, só referência): `dupply-frontend/docs/notes/2026-05-15_stellar-duplicata-master-implementation-guide.md`.

## Indexador (MVP)

Ver [indexer/README.md](indexer/README.md) e `indexer/src/index.js`.

## Notas

- O **frontend** (`dupply-frontend`) não faz parte destas alterações.
- **Não** foi executado `git push` para remoto como parte desta entrega.
