import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { loadConfig } from "../../../src/infra/env/config.js";
import { createGateways } from "../../../src/infra/gateways/factories/createGateways.js";
import { createBlindPaySettlementGateway } from "../../../src/infra/gateways/providers/blindpay/blindPaySettlementGateway.js";
import { createEtherfuseRampGateway } from "../../../src/infra/gateways/providers/etherfuse/etherfuseRampGateway.js";
import { createStellarRegistryGateway } from "../../../src/infra/gateways/providers/stellar/stellarRegistryGateway.js";
import type { IssuePayload } from "../../../src/infra/generated/trade-bill-registry-contract.js";

function testConfig(overrides: Record<string, string> = {}) {
  return loadConfig({
    DATABASE_URL: "file::memory:",
    JWT_SECRET: "test-jwt-secret-16chars",
    ETHERFUSE_API_KEY: "test-etherfuse-key",
    ETHERFUSE_WEBHOOK_SECRET: Buffer.from("webhook-secret").toString("base64"),
    DUPPLY_REGISTRY_CONTRACT_ID: "C".padEnd(56, "A"),
    ...overrides,
  });
}

describe("createGateways", () => {
  it("returns object implementing all three port interfaces", () => {
    const gateways = createGateways(testConfig());
    assert.equal(typeof gateways.registry.simulateIssue, "function");
    assert.equal(typeof gateways.registry.confirmTx, "function");
    assert.equal(typeof gateways.registry.getOnChainBill, "function");
    assert.equal(typeof gateways.ramp.getAssets, "function");
    assert.equal(typeof gateways.ramp.createQuote, "function");
    assert.equal(typeof gateways.ramp.createOrder, "function");
    assert.equal(typeof gateways.ramp.verifyWebhookSignature, "function");
    assert.equal(typeof gateways.settlement.initiatePixPayment, "function");
    assert.equal(typeof gateways.settlement.getPaymentStatus, "function");
  });
});

describe("createStellarRegistryGateway", () => {
  it("delegates simulateIssue and maps predictedChainBillId", async () => {
    const simulateIssueFn = mock.fn(async () => ({
      unsignedXdr: "xdr-test",
      assembledJson: '{"ok":true}',
      predictedChainId: "42",
      simulationLedger: "100",
    }));

    const gateway = createStellarRegistryGateway(testConfig(), {
      simulateIssueFn: simulateIssueFn as never,
    });
    const payload = {} as IssuePayload;
    const result = await gateway.simulateIssue({
      issuerPublicKey: "G".padEnd(56, "A"),
      payload,
    });

    assert.equal(result.unsignedXdr, "xdr-test");
    assert.equal(result.assembledJson, '{"ok":true}');
    assert.equal(result.simulationLedger, "100");
    assert.equal(result.predictedChainBillId, "42");
    assert.equal(simulateIssueFn.mock.callCount(), 1);
  });

  it("delegates confirmTx to parseSuccessfulIssueTx", async () => {
    const parseSuccessfulIssueTxFn = mock.fn(async () => ({
      chainBillId: "9",
      ledger: "55",
      issuedAtUnix: "1700000000",
    }));

    const gateway = createStellarRegistryGateway(testConfig(), {
      parseSuccessfulIssueTxFn: parseSuccessfulIssueTxFn as never,
    });
    const result = await gateway.confirmTx({ txHash: "abc" });

    assert.equal(result.chainBillId, "9");
    assert.equal(result.ledger, "55");
    assert.equal(result.issuedAtUnix, "1700000000");
    assert.equal(parseSuccessfulIssueTxFn.mock.callCount(), 1);
  });
});

describe("createEtherfuseRampGateway", () => {
  it("getAssets returns asset list from mocked HTTP", async () => {
    const assets = [{ symbol: "MXN", identifier: "mxn" }];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () =>
      new Response(JSON.stringify({ assets }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as typeof fetch;

    try {
      const gateway = createEtherfuseRampGateway(testConfig());
      const result = await gateway.getAssets({
        blockchain: "stellar",
        currency: "mxn",
        wallet: "G".padEnd(56, "B"),
      });
      assert.deepEqual(result, assets);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws when ETHERFUSE_API_KEY is missing", async () => {
    const gateway = createEtherfuseRampGateway(
      testConfig({ ETHERFUSE_API_KEY: "" }),
    );
    await assert.rejects(
      () =>
        gateway.getAssets({
          blockchain: "stellar",
          currency: "mxn",
          wallet: "G".padEnd(56, "B"),
        }),
      /ETHERFUSE_API_KEY/,
    );
  });
});

describe("createBlindPaySettlementGateway", () => {
  it("initiatePixPayment throws not implemented", async () => {
    const gateway = createBlindPaySettlementGateway(testConfig());
    await assert.rejects(
      () =>
        gateway.initiatePixPayment({
          amountCents: 1000,
          payerDocument: "12345678901",
          referenceId: "ref-1",
        }),
      /not implemented/i,
    );
  });

  it("getPaymentStatus throws not implemented", async () => {
    const gateway = createBlindPaySettlementGateway(testConfig());
    await assert.rejects(() => gateway.getPaymentStatus("pay-1"), /not implemented/i);
  });
});
