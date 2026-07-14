import { randomUUID } from "node:crypto";

import type { AppDeps } from "../../../../compose/deps.js";
import type { RampQuoteAssets } from "../../../../infra/gateways/ports/rampGateway.js";
import { rampQuotes } from "../../../../infra/database/schema.runtime.js";
import {
  fiatHintForQuoteAssets,
  nowMs,
  resolveQuoteAssetsFromMap,
} from "../rampHelpers.js";

export class WalletAddressRequiredError extends Error {
  constructor() {
    super("walletAddress required when resolveAssetIdentifiers is true");
    this.name = "WalletAddressRequiredError";
  }
}

export type CreateRampQuoteInput = {
  customerId: string;
  blockchain: string;
  quoteAssets: RampQuoteAssets;
  sourceAmount: string;
  walletAddress?: string;
  resolveAssetIdentifiers?: boolean;
  userId?: string;
};

export type CreateRampQuoteResult = {
  id: string;
  etherfuseQuoteId: string;
  quote: unknown;
};

export async function executeCreateRampQuote(
  deps: AppDeps,
  input: CreateRampQuoteInput,
): Promise<CreateRampQuoteResult> {
  const internalId = randomUUID();
  const quoteId = randomUUID();

  let quoteAssets = input.quoteAssets;
  if (input.resolveAssetIdentifiers) {
    const w = input.walletAddress?.trim();
    if (!w) throw new WalletAddressRequiredError();
    const fiat = fiatHintForQuoteAssets(quoteAssets);
    const assets = await deps.gateways.ramp.getAssets({
      blockchain: input.blockchain,
      currency: fiat.toLowerCase(),
      wallet: w,
    });
    quoteAssets = resolveQuoteAssetsFromMap(quoteAssets, assets);
  }

  const efBody = {
    quoteId,
    customerId: input.customerId,
    blockchain: input.blockchain,
    quoteAssets,
    sourceAmount: input.sourceAmount,
    walletAddress: input.walletAddress ?? undefined,
  };

  const responseJson = await deps.gateways.ramp.createQuote(efBody);

  const resObj = responseJson as Record<string, unknown>;
  const expiresRaw = resObj.expiresAt ?? resObj.expires_at;
  const expiresAtMs =
    typeof expiresRaw === "string" || typeof expiresRaw === "number"
      ? String(new Date(expiresRaw).getTime())
      : null;

  await deps.db.insert(rampQuotes).values({
    id: internalId,
    userId: input.userId ?? null,
    provider: "etherfuse",
    externalQuoteId: quoteId,
    requestJson: JSON.stringify(efBody),
    responseJson: JSON.stringify(responseJson),
    expiresAtMs,
    status: "active",
    createdAtMs: nowMs(),
  });

  return {
    id: internalId,
    etherfuseQuoteId: quoteId,
    quote: responseJson,
  };
}
