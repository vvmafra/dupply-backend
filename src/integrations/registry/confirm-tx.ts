import { scValToNative } from "@stellar/stellar-base";
import { Api, Server as SorobanServer } from "@stellar/stellar-sdk/rpc";

export class TxNotFoundError extends Error {
  constructor() {
    super("transaction not found on Soroban RPC");
    this.name = "TxNotFoundError";
  }
}

export class TxFailedError extends Error {
  constructor(readonly detail: string) {
    super("transaction failed on-chain");
    this.name = "TxFailedError";
  }
}

export async function parseSuccessfulIssueTx(
  rpcUrl: string,
  txHash: string,
): Promise<{ chainBillId: string; ledger: string; issuedAtUnix: string }> {
  const server = new SorobanServer(rpcUrl);
  const res = await server.getTransaction(txHash);
  if (res.status === Api.GetTransactionStatus.SUCCESS) {
    if (res.returnValue === undefined) {
      throw new Error("successful transaction has no Soroban return value");
    }
    const native = scValToNative(res.returnValue);
    const chainBillId =
      typeof native === "bigint"
        ? native.toString()
        : typeof native === "number"
          ? String(native)
          : String(native);
    return {
      chainBillId,
      ledger: String(res.ledger),
      issuedAtUnix: String(res.createdAt),
    };
  }
  if (res.status === Api.GetTransactionStatus.NOT_FOUND) {
    throw new TxNotFoundError();
  }
  if (res.status === Api.GetTransactionStatus.FAILED) {
    throw new TxFailedError(JSON.stringify({ status: res.status, txHash: res.txHash }));
  }
  throw new TxFailedError(`unexpected status ${String((res as { status?: string }).status)}`);
}
