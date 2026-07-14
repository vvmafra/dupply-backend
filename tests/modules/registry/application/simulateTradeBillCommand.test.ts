import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { executeSimulateTradeBill } from "../../../../src/modules/registry/application/commands/simulateTradeBillCommand.js";
import type { AppDeps } from "../../../../src/compose/deps.js";
import type { CreateTradeBillBody } from "../../../../src/modules/registry/domain/tradeBill/dto.js";

const HASH = "a".repeat(64);

function validBody(overrides: Partial<CreateTradeBillBody> = {}): CreateTradeBillBody {
  return {
    issuerPublicKey: "G".padEnd(56, "A"),
    billKind: "commercial",
    draftNumberHash: HASH,
    invoiceNumberHash: HASH,
    fiscalDocKeyHash: HASH,
    draweeCommitment: HASH,
    fiscalDocKind: "nfe",
    evidenceKind: "delivery",
    draweeAcceptance: "accepted",
    faceValueCents: "10000",
    maxAdvanceValueCents: "5000",
    issueDateUnix: 1_700_000_000,
    dueDateUnix: 1_700_086_400,
    fiscalDocAttached: true,
    evidenceAttached: true,
    fraudDeclarationsAccepted: true,
    discountEligible: false,
    ...overrides,
  };
}

describe("executeSimulateTradeBill", () => {
  it("delegates to deps.gateways.registry.simulateIssue and persists draft", async () => {
    const inserted: unknown[] = [];
    const simulateIssue = mock.fn(async (_input: unknown) => ({
      unsignedXdr: "xdr",
      assembledJson: "{}",
      simulationLedger: "99",
      predictedChainBillId: "7",
    }));

    const deps = {
      config: { DUPPLY_REGISTRY_CONTRACT_ID: "C".padEnd(56, "A") },
      gateways: {
        registry: { simulateIssue },
      },
      db: {
        insert: () => ({
          values: async (row: unknown) => {
            inserted.push(row);
          },
        }),
      },
    } as unknown as AppDeps;

    const body = validBody();
    const result = await executeSimulateTradeBill(deps, body);

    assert.equal(result.status, "simulated");
    assert.equal(result.predictedChainBillId, "7");
    assert.equal(result.unsignedTransactionXdr, "xdr");
    assert.equal(simulateIssue.mock.callCount(), 1);
    assert.equal(inserted.length, 1);
  });
});
