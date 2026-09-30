export type PixPaymentRequest = {
  amountCents: number;
  payerDocument: string;
  referenceId: string;
};

export interface SettlementGateway {
  /** Returns provider payment id; throws if provider unavailable. */
  initiatePixPayment(req: PixPaymentRequest): Promise<{ providerPaymentId: string }>;
  getPaymentStatus(providerPaymentId: string): Promise<"pending" | "completed" | "failed">;
}
