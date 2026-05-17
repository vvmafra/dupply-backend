/**
 * Smoke test against Etherfuse sandbox (requires real credentials).
 * @see https://docs.etherfuse.com/overview
 * @see https://docs.etherfuse.com/api-reference/assets/get-rampable-assets
 *
 * Usage:
 *   set -a && . ./.env && set +a && npm run etherfuse:smoke
 *
 * Env:
 *   ETHERFUSE_API_KEY, ETHERFUSE_SMOKE_CUSTOMER_ID (required)
 *   ETHERFUSE_SMOKE_WALLET_ADDRESS — Stellar G... used in onboarding (required unless ETHERFUSE_SMOKE_TARGET_ASSET is set)
 *   ETHERFUSE_SMOKE_TARGET_ASSET — optional override (e.g. CETES:G...)
 *   ETHERFUSE_SMOKE_AMOUNT — default "100"
 */
import { randomUUID } from "node:crypto";

import { EtherfuseClient } from "../src/integrations/etherfuse/client.js";

const baseUrl = process.env.ETHERFUSE_BASE_URL ?? "https://api.sand.etherfuse.com";
const apiKey = process.env.ETHERFUSE_API_KEY;

type RampAssetsResponse = { assets?: { symbol?: string; identifier?: string }[] };

async function fetchRampableTargetAsset(
  wallet: string,
): Promise<string | undefined> {
  const u = new URL("/ramp/assets", baseUrl.replace(/\/$/, ""));
  u.searchParams.set("blockchain", "stellar");
  u.searchParams.set("currency", "mxn");
  u.searchParams.set("wallet", wallet);
  const res = await fetch(u, {
    headers: { Authorization: apiKey ?? "" },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("GET /ramp/assets failed:", res.status, text.slice(0, 500));
    return undefined;
  }
  const data = JSON.parse(text) as RampAssetsResponse;
  const list = data.assets ?? [];
  const cetes = list.find((a) => a.symbol === "CETES" && a.identifier);
  if (cetes?.identifier) return cetes.identifier;
  return list[0]?.identifier;
}

async function main(): Promise<void> {
  if (!apiKey) {
    console.error("Set ETHERFUSE_API_KEY (sandbox key from Etherfuse).");
    process.exit(1);
  }
  const customerId = process.env.ETHERFUSE_SMOKE_CUSTOMER_ID;
  if (!customerId) {
    console.error("Set ETHERFUSE_SMOKE_CUSTOMER_ID (UUID from your sandbox onboarding).");
    process.exit(1);
  }

  const wallet = process.env.ETHERFUSE_SMOKE_WALLET_ADDRESS?.trim();
  const overrideTarget = process.env.ETHERFUSE_SMOKE_TARGET_ASSET?.trim();
  let targetAsset = overrideTarget;
  if (!targetAsset) {
    if (!wallet) {
      console.error(
        "Set ETHERFUSE_SMOKE_WALLET_ADDRESS (Stellar public key from onboarding) or ETHERFUSE_SMOKE_TARGET_ASSET.",
      );
      process.exit(1);
    }
    targetAsset = await fetchRampableTargetAsset(wallet);
    if (!targetAsset) {
      console.error("Could not resolve a target asset from GET /ramp/assets.");
      process.exit(1);
    }
    console.error("(smoke) using targetAsset from /ramp/assets:", targetAsset);
  }

  const quoteId = randomUUID();
  const client = new EtherfuseClient(baseUrl, apiKey);

  const quote = await client.createQuote({
    quoteId,
    customerId,
    blockchain: "stellar",
    quoteAssets: {
      type: "onramp",
      sourceAsset: "MXN",
      targetAsset,
    },
    sourceAmount: process.env.ETHERFUSE_SMOKE_AMOUNT ?? "100",
    walletAddress: wallet || undefined,
  });

  console.log(JSON.stringify(quote, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
