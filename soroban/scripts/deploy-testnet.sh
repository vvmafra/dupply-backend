#!/usr/bin/env bash
# Deploy opcional para Stellar Testnet. Não inclui segredos.
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WS"
WASM="${WASM_PATH:-$WS/target/wasm32v1-none/release/duplicata_registry.wasm}"
if [[ ! -f "$WASM" ]]; then
  echo "Wasm não encontrado: $WASM — rode: stellar contract build"
  exit 1
fi
if [[ -z "${STELLAR_IDENTITY:-}" ]]; then
  echo "Defina STELLAR_IDENTITY com o nome da identidade stellar (ex.: export STELLAR_IDENTITY=alice)"
  exit 1
fi
NET="${STELLAR_NETWORK:-testnet}"
echo "Deploying $WASM as $STELLAR_IDENTITY on $NET ..."
stellar contract deploy --wasm "$WASM" --source "$STELLAR_IDENTITY" --network "$NET"
