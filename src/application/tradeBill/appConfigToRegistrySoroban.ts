import type { AppConfig } from "../../config.js";
import type { RegistrySorobanConfig } from "../../integrations/registry/soroban-config.js";

/** Map full app config to the slice required by `integrations/registry` (boundary composition). */
export function appConfigToRegistrySoroban(app: AppConfig): RegistrySorobanConfig {
  return {
    DUPPLY_REGISTRY_CONTRACT_ID: app.DUPPLY_REGISTRY_CONTRACT_ID,
    SOROBAN_RPC_URL: app.SOROBAN_RPC_URL,
    STELLAR_NETWORK: app.STELLAR_NETWORK,
  };
}
