import type { AppConfig } from "../../../env/config.js";
import type {
  RampAssetsQuery,
  RampGateway,
  RampOrderRequest,
  RampQuoteRequest,
} from "../../ports/rampGateway.js";
import {
  EtherfuseClient,
  type Blockchain,
  type QuoteAssets,
} from "./client.js";
import { verifyEtherfuseWebhookSignature } from "./webhook-verify.js";

/**
 * Etherfuse ramp gateway — wraps `providers/etherfuse/client.ts` + webhook verify.
 */
export function createEtherfuseRampGateway(config: AppConfig): RampGateway {
  function requireClient(): EtherfuseClient {
    if (!config.ETHERFUSE_API_KEY?.trim()) {
      throw new Error("ETHERFUSE_API_KEY is not configured");
    }
    return new EtherfuseClient(config.ETHERFUSE_BASE_URL, config.ETHERFUSE_API_KEY);
  }

  return {
    async getAssets(query: RampAssetsQuery) {
      const client = requireClient();
      const res = await client.getRampAssets(query.blockchain, query.currency, query.wallet);
      return res.assets;
    },

    async createQuote(req: RampQuoteRequest): Promise<unknown> {
      const client = requireClient();
      return client.createQuote({
        quoteId: req.quoteId,
        customerId: req.customerId,
        blockchain: req.blockchain as Blockchain,
        quoteAssets: req.quoteAssets as QuoteAssets,
        sourceAmount: req.sourceAmount,
        walletAddress: req.walletAddress ?? undefined,
      });
    },

    async createOrder(req: RampOrderRequest): Promise<unknown> {
      const client = requireClient();
      return client.createOrder({
        orderId: req.orderId,
        bankAccountId: req.bankAccountId,
        quoteId: req.quoteId,
        publicKey: req.publicKey ?? null,
        cryptoWalletId: req.cryptoWalletId ?? null,
        memo: req.memo ?? null,
        useAnchor: req.useAnchor ?? false,
      });
    },

    verifyWebhookSignature(
      body: Record<string, unknown>,
      signature: string | undefined,
    ): boolean {
      const secret = config.ETHERFUSE_WEBHOOK_SECRET;
      if (!secret) return false;
      return verifyEtherfuseWebhookSignature(body, secret, signature);
    },
  };
}
