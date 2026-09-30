import type { AppDeps } from "../../../../compose/deps.js";
import { RegistryNotConfiguredError } from "../commands/simulateTradeBillCommand.js";

export type GetOnChainTradeBillResult = {
  chainBillId: string;
  tradeBill: Record<string, unknown> | null;
};

export async function executeGetOnChainTradeBill(
  deps: AppDeps,
  input: { chainId: string; issuer: string },
): Promise<GetOnChainTradeBillResult> {
  const { config, gateways } = deps;
  if (!config.DUPPLY_REGISTRY_CONTRACT_ID) {
    throw new RegistryNotConfiguredError();
  }

  const bill = await gateways.registry.getOnChainBill(input.chainId, input.issuer);
  return {
    chainBillId: input.chainId,
    // Empty object from gateway means no on-chain bill (port cannot return null).
    tradeBill: Object.keys(bill).length === 0 ? null : bill,
  };
}
