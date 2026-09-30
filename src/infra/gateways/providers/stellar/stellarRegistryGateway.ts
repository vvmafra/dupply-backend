import { AssembledTransaction } from "@stellar/stellar-sdk/contract";

import type { AppConfig } from "../../../env/config.js";
import type {
  ConfirmTxInput,
  ConfirmTxResult,
  RegistryGateway,
  SimulateIssueInput,
  SimulateIssueResult,
} from "../../ports/registryGateway.js";
import type { TradeBill } from "../../../generated/trade-bill-registry-contract.js";
import { parseSuccessfulIssueTx } from "../../../blockchain/stellar/registry/confirm-tx.js";
import {
  createRegistryClient,
  IssueSimulationError,
  simulateIssue,
} from "../../../blockchain/stellar/registry/issue-flow.js";
import type { RegistrySorobanConfig } from "../../../blockchain/stellar/registry/soroban-config.js";

function toSoroban(config: AppConfig): RegistrySorobanConfig {
  return {
    DUPPLY_REGISTRY_CONTRACT_ID: config.DUPPLY_REGISTRY_CONTRACT_ID,
    SOROBAN_RPC_URL: config.SOROBAN_RPC_URL,
    STELLAR_NETWORK: config.STELLAR_NETWORK,
  };
}

function bufToHex(b: Buffer): string {
  return Buffer.from(b).toString("hex");
}

function serializeTradeBill(d: TradeBill): Record<string, unknown> {
  return {
    ...d,
    draft_number_hash: bufToHex(d.draft_number_hash),
    invoice_number_hash: bufToHex(d.invoice_number_hash),
    fiscal_doc_key_hash: bufToHex(d.fiscal_doc_key_hash),
    drawee_commitment: bufToHex(d.drawee_commitment),
    face_value_cents: d.face_value_cents.toString(),
    max_advance_value_cents: d.max_advance_value_cents.toString(),
    issue_date_unix: d.issue_date_unix.toString(),
    due_date_unix: d.due_date_unix.toString(),
    id: d.id.toString(),
    issued_at: d.issued_at.toString(),
  };
}

export type StellarRegistryGatewayInject = {
  simulateIssueFn?: typeof simulateIssue;
  parseSuccessfulIssueTxFn?: typeof parseSuccessfulIssueTx;
  createRegistryClientFn?: typeof createRegistryClient;
};

/**
 * Stellar/Soroban registry gateway — wraps `infra/blockchain/stellar/registry/*`.
 */
export function createStellarRegistryGateway(
  config: AppConfig,
  inject: StellarRegistryGatewayInject = {},
): RegistryGateway {
  const soroban = toSoroban(config);
  const simulate = inject.simulateIssueFn ?? simulateIssue;
  const parseTx = inject.parseSuccessfulIssueTxFn ?? parseSuccessfulIssueTx;
  const registryClient = inject.createRegistryClientFn ?? createRegistryClient;

  return {
    async simulateIssue(input: SimulateIssueInput): Promise<SimulateIssueResult> {
      const sim = await simulate(soroban, input.issuerPublicKey, input.payload);
      return {
        unsignedXdr: sim.unsignedXdr,
        assembledJson: sim.assembledJson,
        simulationLedger: sim.simulationLedger,
        predictedChainBillId: sim.predictedChainId,
      };
    },

    async confirmTx(input: ConfirmTxInput): Promise<ConfirmTxResult> {
      const parsed = await parseTx(config.SOROBAN_RPC_URL, input.txHash);
      return {
        chainBillId: parsed.chainBillId,
        ledger: parsed.ledger,
        issuedAtUnix: parsed.issuedAtUnix,
        // On-chain bill fetch requires issuer; routes supply that via getOnChainBill.
        tradeBill: {},
      };
    },

    async getOnChainBill(chainBillId: string, issuer: string): Promise<Record<string, unknown>> {
      const client = registryClient(soroban, issuer);
      const tx = await client.get_trade_bill({ id: BigInt(chainBillId) });
      try {
        await tx.simulate();
      } catch (e) {
        if (e instanceof AssembledTransaction.Errors.SimulationFailed) {
          throw new IssueSimulationError(e.message, tx.simulation);
        }
        throw e;
      }
      const bill = tx.result;
      if (!bill) {
        return {};
      }
      return serializeTradeBill(bill);
    },
  };
}
