import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import {
  tradeBillChainRecords,
  tradeBillDrafts,
} from "../../../../infra/database/schema.runtime.js";
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class TradeBillNotFoundError extends Error {
  constructor() {
    super("not_found");
    this.name = "TradeBillNotFoundError";
  }
}

export type GetTradeBillResult = {
  draft: {
    id: string;
    issuerPublicKey: string;
    status: string;
    payload: unknown;
    predictedChainBillId: string | null;
    simulationLedger: string | null;
    lastError: string | null;
    createdAtMs: string;
    updatedAtMs: string;
  };
  chain: {
    id: string;
    chainBillId: string;
    txHash: string;
    ledger: string | null;
    issuedAtLedger: string | null;
    network: string;
    contractId: string;
  } | null;
};

export async function executeGetTradeBill(
  deps: AppDeps,
  draftId: string,
): Promise<GetTradeBillResult> {
  const { db } = deps;
  const [draft] = await db
    .select()
    .from(tradeBillDrafts)
    .where(eq(tradeBillDrafts.id, draftId))
    .limit(1);
  if (!draft) throw new TradeBillNotFoundError();

  const [chain] = await db
    .select()
    .from(tradeBillChainRecords)
    .where(eq(tradeBillChainRecords.draftId, draftId))
    .limit(1);

  return {
    draft: {
      id: draft.id,
      issuerPublicKey: draft.issuerPublicKey,
      status: draft.status,
      payload: safeJson(draft.payloadJson),
      predictedChainBillId: draft.predictedChainId,
      simulationLedger: draft.simulationLedger,
      lastError: draft.lastError,
      createdAtMs: draft.createdAtMs,
      updatedAtMs: draft.updatedAtMs,
    },
    chain: chain
      ? {
          id: chain.id,
          chainBillId: chain.chainBillId,
          txHash: chain.txHash,
          ledger: chain.ledger,
          issuedAtLedger: chain.issuedAtLedger,
          network: chain.network,
          contractId: chain.contractId,
        }
      : null,
  };
}
