import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import type { AppDeps } from "../../../../compose/deps.js";
import {
  tradeBillChainRecords,
  tradeBillDrafts,
} from "../../../../infra/database/schema.runtime.js";
import {
  TxFailedError,
  TxNotFoundError,
} from "../registryErrors.js";
import { RegistryNotConfiguredError } from "./simulateTradeBillCommand.js";

function nowMs(): string {
  return String(Date.now());
}

export class DraftNotFoundError extends Error {
  constructor() {
    super("draft_not_found");
    this.name = "DraftNotFoundError";
  }
}

export class TxHashAlreadyConfirmedError extends Error {
  constructor(readonly chainRecordId: string) {
    super("tx_hash_already_confirmed");
    this.name = "TxHashAlreadyConfirmedError";
  }
}

export class DuplicateChainBillIdError extends Error {
  constructor() {
    super("duplicate_chain_bill_id");
    this.name = "DuplicateChainBillIdError";
  }
}

export type ConfirmTradeBillResult = {
  id: string;
  status: "confirmed";
  /** Full chain row on idempotent re-confirm; shaped subset on first confirm. */
  chain: Record<string, unknown> | null;
};

export async function executeConfirmTradeBill(
  deps: AppDeps,
  input: { draftId: string; txHash: string },
): Promise<ConfirmTradeBillResult> {
  const { db, config, gateways } = deps;
  if (!config.DUPPLY_REGISTRY_CONTRACT_ID) {
    throw new RegistryNotConfiguredError();
  }

  const { draftId, txHash } = input;

  const [draft] = await db
    .select()
    .from(tradeBillDrafts)
    .where(eq(tradeBillDrafts.id, draftId))
    .limit(1);
  if (!draft) throw new DraftNotFoundError();

  if (draft.status === "confirmed") {
    const [existing] = await db
      .select()
      .from(tradeBillChainRecords)
      .where(eq(tradeBillChainRecords.draftId, draftId))
      .limit(1);
    return { id: draftId, status: "confirmed", chain: existing ?? null };
  }

  const [dupTx] = await db
    .select()
    .from(tradeBillChainRecords)
    .where(eq(tradeBillChainRecords.txHash, txHash))
    .limit(1);
  if (dupTx) {
    throw new TxHashAlreadyConfirmedError(dupTx.id);
  }

  try {
    const parsedTx = await gateways.registry.confirmTx({ txHash });
    const recordId = randomUUID();
    const t = nowMs();
    try {
      await db.insert(tradeBillChainRecords).values({
        id: recordId,
        draftId,
        network: config.STELLAR_NETWORK,
        contractId: config.DUPPLY_REGISTRY_CONTRACT_ID,
        chainBillId: parsedTx.chainBillId,
        txHash,
        ledger: parsedTx.ledger,
        issuedAtLedger: parsedTx.issuedAtUnix,
        createdAtMs: t,
      });
    } catch (insErr: unknown) {
      const msg = insErr instanceof Error ? insErr.message : String(insErr);
      if (msg.includes("UNIQUE constraint failed")) {
        throw new DuplicateChainBillIdError();
      }
      throw insErr;
    }
    await db
      .update(tradeBillDrafts)
      .set({ status: "confirmed", updatedAtMs: t, lastError: null })
      .where(eq(tradeBillDrafts.id, draftId));
    return {
      id: draftId,
      status: "confirmed",
      chain: {
        id: recordId,
        chainBillId: parsedTx.chainBillId,
        txHash,
        ledger: parsedTx.ledger,
        issuedAtLedger: parsedTx.issuedAtUnix,
        network: config.STELLAR_NETWORK,
        contractId: config.DUPPLY_REGISTRY_CONTRACT_ID,
      },
    };
  } catch (e) {
    if (e instanceof TxNotFoundError) {
      const t = nowMs();
      await db
        .update(tradeBillDrafts)
        .set({ status: "failed", updatedAtMs: t, lastError: e.message })
        .where(eq(tradeBillDrafts.id, draftId));
      throw e;
    }
    if (e instanceof TxFailedError) {
      const t = nowMs();
      await db
        .update(tradeBillDrafts)
        .set({ status: "failed", updatedAtMs: t, lastError: e.detail })
        .where(eq(tradeBillDrafts.id, draftId));
      throw e;
    }
    throw e;
  }
}
