import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { executeGetRampAssets } from "../../../../src/modules/ramp/application/queries/getRampAssets.js";
import type { AppDeps } from "../../../../src/compose/deps.js";

describe("executeGetRampAssets", () => {
  it("delegates to deps.gateways.ramp.getAssets", async () => {
    const assets = [{ symbol: "MXN", identifier: "mxn" }];
    const getAssets = mock.fn(async () => assets);

    const deps = {
      gateways: {
        ramp: { getAssets },
      },
    } as unknown as AppDeps;

    const result = await executeGetRampAssets(deps, {
      blockchain: "stellar",
      currency: "mxn",
      wallet: "G".padEnd(56, "B"),
    });

    assert.deepEqual(result, { assets });
    assert.equal(getAssets.mock.callCount(), 1);
    const firstCall = getAssets.mock.calls[0] as { arguments: unknown[] } | undefined;
    assert.deepEqual(firstCall?.arguments[0], {
      blockchain: "stellar",
      currency: "mxn",
      wallet: "G".padEnd(56, "B"),
    });
  });
});
