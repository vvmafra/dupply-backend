# Dupply indexer (esqueleto)

Placeholder para ingerir eventos `DuplicataIssued` do contrato `duplicata-registry` via RPC Soroban / ledger.

## Variáveis

- `SOROBAN_RPC_URL` — URL RPC Soroban (testnet/mainnet conforme doc Stellar).
- `DUPLICATA_REGISTRY_CONTRACT_ID` — endereço `C...` do contrato deployado.

## Arranque

```bash
cd indexer
npm install   # quando houver dependências Soroban JS
node src/index.js
```

Idempotência sugerida: chave `(ledger_sequence, tx_hash, event_index)` por evento.

Documentação Stellar: [Smart contracts](https://developers.stellar.org/docs/build/smart-contracts/overview).
