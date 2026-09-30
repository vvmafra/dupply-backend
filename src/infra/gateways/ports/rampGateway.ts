export type RampQuoteAssets =
  | { type: "onramp"; sourceAsset: string; targetAsset: string }
  | { type: "offramp"; sourceAsset: string; targetAsset: string }
  | { type: "swap"; sourceAsset: string; targetAsset: string };

export type RampQuoteRequest = {
  quoteId: string;
  customerId: string;
  blockchain: string;
  quoteAssets: RampQuoteAssets;
  sourceAmount: string;
  walletAddress?: string;
};

export type RampOrderRequest = {
  orderId: string;
  bankAccountId: string;
  quoteId: string;
  publicKey?: string | null;
  cryptoWalletId?: string | null;
  memo?: string | null;
  useAnchor?: boolean;
};

export type RampAssetsQuery = {
  blockchain: string;
  currency: string;
  wallet: string;
};

export type RampAssetRow = {
  symbol: string;
  identifier: string;
  currency?: string;
};

export interface RampGateway {
  getAssets(query: RampAssetsQuery): Promise<RampAssetRow[]>;
  createQuote(req: RampQuoteRequest): Promise<unknown>;
  createOrder(req: RampOrderRequest): Promise<unknown>;
  verifyWebhookSignature(
    body: Record<string, unknown>,
    signature: string | undefined,
  ): boolean;
}
