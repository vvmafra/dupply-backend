# Dupply — `duplicata-registry` (Soroban)

Registry on-chain de duplicatas descontáveis: **allowlist de issuers**, **`issue`** com commitments (`BytesN<32>`), valores em **centavos (`i128`)**, evento **`DuplicataIssued`** ([`contractevent`](https://developers.stellar.org/docs/build/smart-contracts/getting-started/events)).

O código em `crates/duplicata-registry/src/` não usa documentação `///` inline; a API e o domínio descrevem-se neste README e em [DEPLOYMENT-testnet.md](./DEPLOYMENT-testnet.md).

## Toolchain

- **Rust:** `1.92.0` (pin em [rust-toolchain.toml](rust-toolchain.toml)). O `stellar contract build` **rejeita** 1.91.0; ver mensagem da CLI se mudar versão.
- **Alvo:** `wasm32v1-none`
- **soroban-sdk:** workspace `25` (ver [Cargo.toml](Cargo.toml))

## Comandos

Na raiz deste workspace Soroban (`dupply-backend/soroban`):

```bash
cargo test -p duplicata-registry
stellar contract build
```

Wasm release: `target/wasm32v1-none/release/duplicata_registry.wasm`

## Contrato (API)

| Função | Descrição |
|--------|-----------|
| `initialize(admin)` | Uma vez; `admin` assina. |
| `set_admin(new_admin)` | Só `admin` atual. |
| `set_issuer_allowed(issuer, allowed)` | Só `admin`. |
| `issue(issuer, payload)` | Issuer assinado + allowlist + invariantes. Retorna `id` (`u64`). |
| `get_duplicata(id)` | Leitura. |
| `is_issuer_allowed(issuer)` | Leitura. |
| `admin()` / `next_id()` | Leitura. |

### Erros (`RegistryError`)

`AlreadyInitialized`, `NotInitialized`, `Unauthorized` (via auth), `IssuerNotAllowed`, `InvalidAmounts`, `InvalidDates`, `FraudDeclarationsRequired`, `NotFound`, `InvalidDiscountFlags`.

### Invariantes em `issue`

- `declaracoes_antifraude_aceitas == true`
- `valor_face_centavos > 0`
- `0 <= valor_max_antecipacao_centavos <= valor_face_centavos`
- `data_vencimento_unix > data_emissao_unix`
- Se `discount_eligible`: `doc_fiscal_anexado && comprovante_anexado`

## Deploy (testnet)

Não commitar chaves. Exemplo (ajustar identidade / rede conforme [Stellar docs](https://developers.stellar.org/docs/build/smart-contracts/getting-started/deploy-to-testnet)):

```bash
stellar contract deploy   --wasm target/wasm32v1-none/release/duplicata_registry.wasm   --source SAUA...   --network testnet
```

Script opcional: [scripts/deploy-testnet.sh](scripts/deploy-testnet.sh)

## Referência de domínio (front)

Tipos alinhados a `dupply-frontend` (só documentação; o front **não** é alterado por este crate): `src/domain/duplicata/duplicata.types.ts`.

## Estrutura

```text
soroban/
  Cargo.toml                    # workspace (members: crates/*)
  rust-toolchain.toml
  crates/duplicata-registry/
    Cargo.toml
    Makefile
    src/
      lib.rs
      types.rs
      error.rs
      test.rs
  scripts/
```
