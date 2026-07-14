import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DomainError,
  validateIssueInvariants,
  type CreateTradeBillBody,
} from "../../../../src/modules/registry/domain/tradeBill/dto.js";

const HASH = "b".repeat(64);

function validBody(overrides: Partial<CreateTradeBillBody> = {}): CreateTradeBillBody {
  return {
    issuerPublicKey: "G".padEnd(56, "A"),
    billKind: "service",
    draftNumberHash: HASH,
    invoiceNumberHash: HASH,
    fiscalDocKeyHash: HASH,
    draweeCommitment: HASH,
    fiscalDocKind: "nfse",
    evidenceKind: "service_performed",
    draweeAcceptance: "pending",
    faceValueCents: "1000",
    maxAdvanceValueCents: "100",
    issueDateUnix: 100,
    dueDateUnix: 200,
    fiscalDocAttached: true,
    evidenceAttached: true,
    fraudDeclarationsAccepted: true,
    discountEligible: false,
    ...overrides,
  };
}

describe("validateIssueInvariants", () => {
  it("accepts a valid body", () => {
    assert.doesNotThrow(() => validateIssueInvariants(validBody()));
  });

  it("rejects when fraud declarations are false", () => {
    assert.throws(
      () => validateIssueInvariants(validBody({ fraudDeclarationsAccepted: false })),
      (e: unknown) => e instanceof DomainError && (e as DomainError).code === "FraudDeclarationsRequired",
    );
  });

  it("rejects when due date is not after issue date", () => {
    assert.throws(
      () => validateIssueInvariants(validBody({ issueDateUnix: 200, dueDateUnix: 200 })),
      (e: unknown) => e instanceof DomainError && (e as DomainError).code === "InvalidDates",
    );
  });
});
