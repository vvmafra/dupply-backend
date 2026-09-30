/**
 * Minimal config needed to call the trade-bill Soroban registry.
 * Kept in blockchain/stellar so this adapter does not depend on full AppConfig.
 */
export type RegistrySorobanConfig = {
  DUPPLY_REGISTRY_CONTRACT_ID?: string;
  SOROBAN_RPC_URL: string;
  STELLAR_NETWORK: "testnet" | "mainnet" | "futurenet";
};
