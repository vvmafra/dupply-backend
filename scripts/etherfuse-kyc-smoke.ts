/**
 * Programmatic KYC on Etherfuse sandbox (personal → often auto-approved).
 * @see https://docs.etherfuse.com/guides/onboarding-programmatic
 * @see https://docs.etherfuse.com/api-reference/kyc/submit-kyc-identity-data
 *
 * Usage:
 *   set -a && . ./.env && set +a && npm run etherfuse:kyc-smoke
 *
 * Env:
 *   ETHERFUSE_API_KEY (required — sandbox key, not a docs URL)
 *   ETHERFUSE_BASE_URL — default https://api.sand.etherfuse.com
 *   ETHERFUSE_KYC_CUSTOMER_ID — optional; new UUID if unset
 *   ETHERFUSE_KYC_WALLET — optional Stellar G...; random keypair if unset
 *   ETHERFUSE_KYC_SKIP_ORG — set to "1" if org already exists for customer id
 */
import { randomUUID } from "node:crypto";

import { Keypair } from "@stellar/stellar-sdk";

import { EtherfuseClient, EtherfuseHttpError } from "../src/integrations/etherfuse/client.js";
import type { KycIdentityPayload } from "../src/integrations/etherfuse/kyc-types.js";

const baseUrl = process.env.ETHERFUSE_BASE_URL ?? "https://api.sand.etherfuse.com";
const apiKey = process.env.ETHERFUSE_API_KEY?.trim();

/** Mexico sample (matches regional-starter-pack Etherfuse KYC shape). */
function sandboxIdentity(pubkey: string): KycIdentityPayload {
  return {
    id: pubkey,
    name: { givenName: "Juan", familyName: "García" },
    dateOfBirth: "1990-05-15",
    address: {
      street: "Av. Reforma 123",
      city: "Ciudad de México",
      region: "CDMX",
      postalCode: "06600",
      country: "MX",
    },
    idNumbers: [{ value: "GAGJ900515HDFRNN09", type: "CURP" }],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  if (!apiKey) {
    console.error("Set ETHERFUSE_API_KEY (sandbox key from Etherfuse dashboard).");
    process.exit(1);
  }
  if (apiKey.startsWith("http://") || apiKey.startsWith("https://")) {
    console.error(
      "ETHERFUSE_API_KEY looks like a URL, not an API key. Paste the sandbox key from Etherfuse (not docs.etherfuse.com).",
    );
    process.exit(1);
  }

  const customerId = process.env.ETHERFUSE_KYC_CUSTOMER_ID?.trim() || randomUUID();
  const pubkey =
    process.env.ETHERFUSE_KYC_WALLET?.trim() || Keypair.random().publicKey();
  const email =
    process.env.ETHERFUSE_KYC_EMAIL?.trim() || `dupply-kyc-${customerId.slice(0, 8)}@example.com`;
  const skipOrg = process.env.ETHERFUSE_KYC_SKIP_ORG === "1";

  const client = new EtherfuseClient(baseUrl, apiKey);

  console.log("Etherfuse KYC smoke");
  console.log("  baseUrl:", baseUrl);
  console.log("  customerId:", customerId);
  console.log("  pubkey:", pubkey);

  if (!skipOrg) {
    try {
      const org = await client.createChildOrganization({
        id: customerId,
        displayName: "Dupply Dev Seller",
        accountType: "personal",
        userInfo: { email, displayName: "Dupply Dev Seller" },
        wallets: [{ publicKey: pubkey, blockchain: "stellar" }],
      });
      console.log("createChildOrganization OK:", JSON.stringify(org, null, 2));
    } catch (e) {
      if (e instanceof EtherfuseHttpError && (e.status === 409 || e.bodyText.includes("exist"))) {
        console.log("(org may already exist, continuing)", e.status, e.bodyText.slice(0, 200));
      } else {
        throw e;
      }
    }
  } else {
    console.log("(skip org) ETHERFUSE_KYC_SKIP_ORG=1");
  }

  const submit = await client.submitKycIdentity(customerId, {
    pubkey,
    identity: sandboxIdentity(pubkey),
  });
  console.log("submitKycIdentity:", JSON.stringify(submit, null, 2));

  const approvedStatuses = new Set([
    "approved",
    "approved_chain_deploying",
  ]);

  for (let i = 0; i < 12; i++) {
    const status = await client.getKycStatus(customerId, pubkey);
    console.log(`getKycStatus [${i + 1}]:`, JSON.stringify(status, null, 2));
    if (approvedStatuses.has(status.status)) {
      console.log("\nKYC approved. Save for ramp smoke:");
      console.log(`  ETHERFUSE_SMOKE_CUSTOMER_ID=${customerId}`);
      console.log(`  ETHERFUSE_SMOKE_WALLET_ADDRESS=${pubkey}`);
      return;
    }
    if (status.status === "rejected") {
      console.error("KYC rejected:", status.currentRejectionReason ?? "(no reason)");
      process.exit(1);
    }
    await sleep(2000);
  }

  console.error("Timed out waiting for approved status (sandbox personal usually approves in seconds).");
  process.exit(1);
}

main().catch((e) => {
  if (e instanceof EtherfuseHttpError) {
    console.error("Etherfuse error:", e.status, e.bodyText);
  } else {
    console.error(e);
  }
  process.exit(1);
});
