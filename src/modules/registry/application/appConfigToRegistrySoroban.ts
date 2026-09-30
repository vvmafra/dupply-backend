import type { AppConfig } from "../../../infra/env/config.js";
import type { RegistrySorobanConfig } from "../../../infra/blockchain/stellar/registry/soroban-config.js";

/** Map full app config to the slice required by Stellar registry blockchain adapter. */
export function appConfigToRegistrySoroban(app: AppConfig): RegistrySorobanConfig {
  return {
    DUPPLY_REGISTRY_CONTRACT_ID: app.DUPPLY_REGISTRY_CONTRACT_ID,
    SOROBAN_RPC_URL: app.SOROBAN_RPC_URL,
    STELLAR_NETWORK: app.STELLAR_NETWORK,
  };
}
