import type { AppDeps } from "../../deps.js";
import {
  EtherfuseClient,
  type Blockchain,
  type RampAssetsResponse,
} from "../../../integrations/etherfuse/client.js";

export type GetRampAssetsInput = {
  blockchain: Blockchain;
  currency: string;
  wallet: string;
  /** Precondition: caller must ensure key is configured (e.g. HTTP 503 if missing). */
  etherfuseApiKey: string;
};

export async function executeGetRampAssets(
  deps: AppDeps,
  input: GetRampAssetsInput,
): Promise<RampAssetsResponse> {
  const client = new EtherfuseClient(deps.config.ETHERFUSE_BASE_URL, input.etherfuseApiKey);
  return client.getRampAssets(input.blockchain, input.currency, input.wallet);
}
