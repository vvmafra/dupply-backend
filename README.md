# dupply-backend

Backend Dupply: contrato Soroban **duplicata-registry**, **API HTTP v1** (`api/`) e esqueleto de **indexador**.

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

## API HTTP (v1)

Serviço Fastify + SQLite (dev) + Etherfuse: [api/README.md](api/README.md).

```bash
cd api && cp .env.example .env && npm install && npm run dev
```

## Indexador (MVP)

Ver [indexer/README.md](indexer/README.md) e `indexer/src/index.js`.

## Documentação (v1 backend, anchors, Etherfuse)

Pesquisa e plano detalhados em Markdown:

- [docs/research/2026-05-16_stellar-anchors-seps-and-directory.md](docs/research/2026-05-16_stellar-anchors-seps-and-directory.md) — âncoras Stellar, SEP-24, Anchor Platform, diretório.  
- [docs/research/2026-05-16_stellar-sep10-sep24-deep-dive.md](docs/research/2026-05-16_stellar-sep10-sep24-deep-dive.md) — SEP-10, fluxos deposit/withdraw, SEP-38/45, segurança.  
- [docs/research/2026-05-16_etherfuse-stellar-fx-api.md](docs/research/2026-05-16_etherfuse-stellar-fx-api.md) — Etherfuse, FX API, sandbox, encaixe com Soroban.  
- [docs/notes/2026-05-16_dupply-backend-v1-plan.md](docs/notes/2026-05-16_dupply-backend-v1-plan.md) — plano de execução v1, arquitetura, fases, env vars.
- [docs/notes/2026-05-17_dupply-api-stack.md](docs/notes/2026-05-17_dupply-api-stack.md) — stack da API implementada (`api/`) e decisões.

## Notas

- O **frontend** (`dupply-frontend`) não faz parte destas alterações salvo pedido explícito.
