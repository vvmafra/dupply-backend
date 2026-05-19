import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { Keypair } from "@stellar/stellar-sdk";

import type { AppConfig } from "../../config.js";
import { Client as RegistryContractClient } from "../../generated/trade-bill-registry-contract.js";
import type { IssuePayload } from "../../generated/trade-bill-registry-contract.js";
import { stellarNetworkPassphrase } from "../stellar/network.js";

export class IssuerNotAllowedError extends Error {
  constructor() {
    super("issuer is not on the registry allowlist");
    this.name = "IssuerNotAllowedError";
  }
}

export class RegistryConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryConfigError";
  }
}

export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export class IssueSimulationError extends Error {
  constructor(
    message: string,
    readonly simulation: unknown,
  ) {
    super(message);
    this.name = "IssueSimulationError";
  }
}

function requireRegistryConfig(config: AppConfig): { contractId: string; rpcUrl: string } {
  const contractId = config.DUPPLY_REGISTRY_CONTRACT_ID;
  const rpcUrl = config.SOROBAN_RPC_URL;
  if (!contractId?.trim()) {
    throw new RegistryConfigError("DUPPLY_REGISTRY_CONTRACT_ID is not set");
  }
  return { contractId, rpcUrl };
}

export function createRegistryClient(
  config: AppConfig,
  issuerPublicKey: string,
): RegistryContractClient {
  const { contractId, rpcUrl } = requireRegistryConfig(config);
  try {
    Keypair.fromPublicKey(issuerPublicKey);
  } catch {
    throw new DomainValidationError("invalid issuerPublicKey");
  }
  return new RegistryContractClient({
    contractId,
    rpcUrl,
    networkPassphrase: stellarNetworkPassphrase(config.STELLAR_NETWORK),
    publicKey: issuerPublicKey,
  });
}

export async function assertIssuerAllowed(
  config: AppConfig,
  issuerPublicKey: string,
): Promise<void> {
  const client = createRegistryClient(config, issuerPublicKey);
  const tx = await client.is_issuer_allowed({ issuer: issuerPublicKey });
  await tx.simulate();
  if (tx.result !== true) {
    throw new IssuerNotAllowedError();
  }
}

export async function simulateIssue(
  config: AppConfig,
  issuerPublicKey: string,
  payload: IssuePayload,
): Promise<{
  unsignedXdr: string;
  assembledJson: string;
  predictedChainId: string;
  simulationLedger: string;
}> {
  await assertIssuerAllowed(config, issuerPublicKey);
  const client = createRegistryClient(config, issuerPublicKey);
  const issueTx = await client.issue({ issuer: issuerPublicKey, payload });
  try {
    await issueTx.simulate();
  } catch (e) {
    if (e instanceof AssembledTransaction.Errors.SimulationFailed) {
      throw new IssueSimulationError(e.message, issueTx.simulation);
    }
    throw e;
  }
  const predicted = issueTx.result;
  if (predicted === undefined) {
    throw new Error("simulation did not produce a return value");
  }
  return {
    unsignedXdr: issueTx.toXDR(),
    assembledJson: issueTx.toJSON(),
    predictedChainId: String(predicted),
    simulationLedger: String(issueTx.simulation?.latestLedger ?? ""),
  };
}
