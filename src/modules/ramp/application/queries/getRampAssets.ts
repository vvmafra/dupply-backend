import type { AppDeps } from "../../../../compose/deps.js";
import type { RampAssetRow } from "../../../../infra/gateways/ports/rampGateway.js";

export type GetRampAssetsInput = {
  blockchain: string;
  currency: string;
  wallet: string;
};

export type RampAssetsResponse = {
  assets: RampAssetRow[];
};

export async function executeGetRampAssets(
  deps: AppDeps,
  input: GetRampAssetsInput,
): Promise<RampAssetsResponse> {
  const assets = await deps.gateways.ramp.getAssets({
    blockchain: input.blockchain,
    currency: input.currency,
    wallet: input.wallet,
  });
  return { assets };
}
