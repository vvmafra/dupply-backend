import { randomUUID } from "node:crypto";

import type { AppDeps } from "../../../../compose/deps.js";
import { tradeBillDrafts } from "../../../../infra/database/schema.runtime.js";
import type { CreateTradeBillBody } from "../../domain/tradeBill/dto.js";
import { validateIssueInvariants } from "../../domain/tradeBill/dto.js";
import { bodyToIssuePayload } from "../mappers/bodyToIssuePayload.js";

function nowMs(): string {
  return String(Date.now());
}

export type SimulateTradeBillResult = {
  id: string;
  status: "simulated";
  issuerPublicKey: string;
  unsignedTransactionXdr: string;
  predictedChainBillId: string;
  simulationLedger: string;
};

export async function executeSimulateTradeBill(
  deps: AppDeps,
  body: CreateTradeBillBody,
): Promise<SimulateTradeBillResult> {
  const { db, config, gateways } = deps;
  if (!config.DUPPLY_REGISTRY_CONTRACT_ID) {
    throw new RegistryNotConfiguredError();
  }

  validateIssueInvariants(body);
  const payload = bodyToIssuePayload(body);
  const sim = await gateways.registry.simulateIssue({
    issuerPublicKey: body.issuerPublicKey,
    payload,
  });

  const id = randomUUID();
  const t = nowMs();
  await db.insert(tradeBillDrafts).values({
    id,
    issuerPublicKey: body.issuerPublicKey,
    status: "simulated",
    payloadJson: JSON.stringify(body),
    unsignedXdr: sim.unsignedXdr,
    assembledJson: sim.assembledJson,
    simulationLedger: sim.simulationLedger,
    predictedChainId: sim.predictedChainBillId,
    lastError: null,
    createdAtMs: t,
    updatedAtMs: t,
  });

  return {
    id,
    status: "simulated",
    issuerPublicKey: body.issuerPublicKey,
    unsignedTransactionXdr: sim.unsignedXdr,
    predictedChainBillId: sim.predictedChainBillId,
    simulationLedger: sim.simulationLedger,
  };
}

export class RegistryNotConfiguredError extends Error {
  constructor() {
    super("DUPPLY_REGISTRY_CONTRACT_ID not configured");
    this.name = "RegistryNotConfiguredError";
  }
}
