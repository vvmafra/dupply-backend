import { Networks } from "@stellar/stellar-sdk";

export function stellarNetworkPassphrase(network: "testnet" | "mainnet" | "futurenet"): string {
  switch (network) {
    case "mainnet":
      return Networks.PUBLIC;
    case "futurenet":
      return Networks.FUTURENET;
    default:
      return Networks.TESTNET;
  }
}
