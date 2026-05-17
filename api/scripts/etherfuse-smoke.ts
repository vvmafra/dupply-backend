/**
 * Smoke test against Etherfuse sandbox (requires real credentials).
 * @see https://docs.etherfuse.com/overview
 *
 * Usage:
 *   ETHERFUSE_API_KEY=... ETHERFUSE_SMOKE_CUSTOMER_ID=... npx tsx scripts/etherfuse-smoke.ts
 */
import { randomUUID } from "node:crypto";

import { EtherfuseClient } from "../src/integrations/etherfuse/client.js";

const baseUrl = process.env.ETHERFUSE_BASE_URL ?? "https://api.sand.etherfuse.com";
const apiKey = process.env.ETHERFUSE_API_KEY;

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

  const quoteId = randomUUID();
  const client = new EtherfuseClient(baseUrl, apiKey);

  const quote = await client.createQuote({
    quoteId,
    customerId,
    blockchain: "stellar",
    quoteAssets: {
      type: "onramp",
      sourceAsset: "MXN",
      targetAsset:
        process.env.ETHERFUSE_SMOKE_TARGET_ASSET ??
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    },
    sourceAmount: process.env.ETHERFUSE_SMOKE_AMOUNT ?? "100",
    walletAddress: process.env.ETHERFUSE_SMOKE_WALLET_ADDRESS,
  });

  console.log(JSON.stringify(quote, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
