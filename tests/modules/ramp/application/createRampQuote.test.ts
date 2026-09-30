import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { executeCreateRampQuote } from "../../../../src/modules/ramp/application/commands/createRampQuote.js";
import type { AppDeps } from "../../../../src/compose/deps.js";

describe("executeCreateRampQuote", () => {
  it("delegates to deps.gateways.ramp.createQuote and persists quote", async () => {
    const inserted: unknown[] = [];
    const createQuote = mock.fn(async () => ({
      expiresAt: "2030-01-01T00:00:00.000Z",
      rate: "1.0",
    }));

    const deps = {
      gateways: {
        ramp: { createQuote },
      },
      db: {
        insert: () => ({
          values: async (row: unknown) => {
            inserted.push(row);
          },
        }),
      },
    } as unknown as AppDeps;

    const result = await executeCreateRampQuote(deps, {
      customerId: "00000000-0000-4000-8000-000000000001",
      blockchain: "stellar",
      quoteAssets: {
        type: "onramp",
        sourceAsset: "MXN",
        targetAsset: "USDC:ISSUER",
      },
      sourceAmount: "100",
    });

    assert.equal(typeof result.id, "string");
    assert.equal(typeof result.etherfuseQuoteId, "string");
    assert.equal(createQuote.mock.callCount(), 1);
    assert.equal(inserted.length, 1);
  });
});
