/**
 * Minimal config needed to call the trade-bill Soroban registry.
 * Kept in `integrations/registry` so this module does not depend on `config.ts`.
 */
export type RegistrySorobanConfig = {
  DUPPLY_REGISTRY_CONTRACT_ID?: string;
  SOROBAN_RPC_URL: string;
  STELLAR_NETWORK: "testnet" | "mainnet" | "futurenet";
};
