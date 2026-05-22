/**
 * Minimal Etherfuse FX API client.
 * Auth: `Authorization: <api-key>` — no `Bearer` prefix (official docs).
 * @see https://docs.etherfuse.com/overview
 */

import type {
  CreateChildOrganizationRequest,
  CreateChildOrganizationResponse,
  KycStatusResponse,
  SubmitKycRequest,
  SubmitKycResponse,
  UploadKycDocumentsRequest,
  UploadKycDocumentsResponse,
} from "./kyc-types.js";

export type {
  CreateChildOrganizationRequest,
  CreateChildOrganizationResponse,
  KycStatusResponse,
  SubmitKycRequest,
  SubmitKycResponse,
  UploadKycDocumentsRequest,
  UploadKycDocumentsResponse,
} from "./kyc-types.js";

export type Blockchain = "stellar" | "solana" | "base" | "polygon" | "monad";

export type QuoteAssets =
  | { type: "onramp"; sourceAsset: string; targetAsset: string }
  | { type: "offramp"; sourceAsset: string; targetAsset: string }
  | { type: "swap"; sourceAsset: string; targetAsset: string };

export type EtherfuseQuoteRequest = {
  quoteId: string;
  customerId: string;
  blockchain: Blockchain;
  quoteAssets: QuoteAssets;
  sourceAmount: string;
  walletAddress?: string | null;
  partnerFeeBps?: number;
};

export type CreateOrderRequest = {
  orderId: string;
  bankAccountId: string;
  quoteId: string;
  publicKey?: string | null;
  cryptoWalletId?: string | null;
  memo?: string | null;
  useAnchor?: boolean;
};

export class EtherfuseHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(message);
    this.name = "EtherfuseHttpError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type RampAssetRow = {
  symbol: string;
  identifier: string;
  currency?: string;
};

export type RampAssetsResponse = {
  assets: RampAssetRow[];
};

export class EtherfuseClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly options: { timeoutMs?: number; maxRetries?: number } = {},
  ) {}

  private url(path: string): string {
    const base = this.baseUrl.replace(/\/$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  }

  /**
   * GET /ramp/assets — required query: blockchain, currency (fiat hint, lowercase), wallet.
   * @see https://docs.etherfuse.com/api-reference/assets/get-rampable-assets
   */
  async getRampAssets(blockchain: string, currency: string, wallet: string): Promise<RampAssetsResponse> {
    const params = new URLSearchParams({
      blockchain,
      currency: currency.toLowerCase(),
      wallet,
    });
    return this.getJson<RampAssetsResponse>(`/ramp/assets?${params.toString()}`);
  }

  async getJson<T>(pathWithQuery: string): Promise<T> {
    const timeoutMs = this.options.timeoutMs ?? 30_000;
    const maxRetries = this.options.maxRetries ?? 3;
    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(this.url(pathWithQuery), {
          method: "GET",
          headers: {
            Authorization: this.apiKey,
          },
          signal: controller.signal,
        });
        const text = await res.text();
        if (res.ok) {
          return JSON.parse(text) as T;
        }
        if (res.status === 429 || res.status >= 500) {
          lastErr = new EtherfuseHttpError(`Etherfuse ${res.status}`, res.status, text);
          const backoff = Math.min(2000, 200 * 2 ** attempt);
          attempt += 1;
          if (attempt > maxRetries) break;
          await sleep(backoff);
          continue;
        }
        throw new EtherfuseHttpError(`Etherfuse ${res.status}`, res.status, text);
      } catch (e) {
        if (e instanceof EtherfuseHttpError) throw e;
        lastErr = e;
        attempt += 1;
        if (attempt > maxRetries) break;
        await sleep(200 * 2 ** attempt);
      } finally {
        clearTimeout(t);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    const timeoutMs = this.options.timeoutMs ?? 30_000;
    const maxRetries = this.options.maxRetries ?? 3;
    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(this.url(path), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: this.apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await res.text();
        if (res.ok) {
          return JSON.parse(text) as T;
        }
        if (res.status === 429 || res.status >= 500) {
          lastErr = new EtherfuseHttpError(
            `Etherfuse ${res.status}`,
            res.status,
            text,
          );
          const backoff = Math.min(2000, 200 * 2 ** attempt);
          attempt += 1;
          if (attempt > maxRetries) break;
          await sleep(backoff);
          continue;
        }
        throw new EtherfuseHttpError(`Etherfuse ${res.status}`, res.status, text);
      } catch (e) {
        if (e instanceof EtherfuseHttpError) throw e;
        lastErr = e;
        attempt += 1;
        if (attempt > maxRetries) break;
        await sleep(200 * 2 ** attempt);
      } finally {
        clearTimeout(t);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  createQuote(body: EtherfuseQuoteRequest): Promise<unknown> {
    return this.postJson("/ramp/quote", body);
  }

  createOrder(body: CreateOrderRequest): Promise<unknown> {
    return this.postJson("/ramp/order", body);
  }

  /**
   * POST /ramp/organization — child org for a customer (step 1 programmatic onboarding).
   * @see https://docs.etherfuse.com/guides/onboarding-programmatic
   */
  createChildOrganization(
    body: CreateChildOrganizationRequest,
  ): Promise<CreateChildOrganizationResponse> {
    return this.postJson("/ramp/organization", body);
  }

  /**
   * POST /ramp/customer/{customerId}/kyc — submit identity (sandbox personal: often auto-approved).
   * @see https://docs.etherfuse.com/api-reference/kyc/submit-kyc-identity-data
   */
  submitKycIdentity(customerId: string, body: SubmitKycRequest): Promise<SubmitKycResponse> {
    return this.postJson(`/ramp/customer/${customerId}/kyc`, body);
  }

  /**
   * POST /ramp/customer/{customerId}/kyc/documents — JPEG/PNG as data URLs (base64).
   * @see https://docs.etherfuse.com/api-reference/kyc/upload-kyc-documents
   */
  uploadKycDocuments(
    customerId: string,
    body: UploadKycDocumentsRequest,
  ): Promise<UploadKycDocumentsResponse> {
    return this.postJson(`/ramp/customer/${customerId}/kyc/documents`, body);
  }

  /**
   * GET /ramp/customer/{customerId}/kyc/{pubkey}
   * @see https://docs.etherfuse.com/api-reference/kyc/get-kyc-status
   */
  getKycStatus(customerId: string, pubkey: string): Promise<KycStatusResponse> {
    return this.getJson(`/ramp/customer/${customerId}/kyc/${encodeURIComponent(pubkey)}`);
  }
}
