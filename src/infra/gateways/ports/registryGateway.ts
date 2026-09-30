import type { IssuePayload } from "../../generated/trade-bill-registry-contract.js";

export type SimulateIssueInput = {
  /** Issuer Stellar public key (G...). */
  issuerPublicKey: string;
  payload: IssuePayload;
};

export type SimulateIssueResult = {
  unsignedXdr: string;
  assembledJson: string;
  simulationLedger: string;
  predictedChainBillId: string;
};

export type ConfirmTxInput = { txHash: string };

export type ConfirmTxResult = {
  chainBillId: string;
  ledger: string;
  issuedAtUnix: string;
  tradeBill: Record<string, unknown>;
};

export interface RegistryGateway {
  simulateIssue(input: SimulateIssueInput): Promise<SimulateIssueResult>;
  confirmTx(input: ConfirmTxInput): Promise<ConfirmTxResult>;
  getOnChainBill(chainBillId: string, issuer: string): Promise<Record<string, unknown>>;
}
