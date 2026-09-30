import type { AppConfig } from "../../../env/config.js";
import type {
  PixPaymentRequest,
  SettlementGateway,
} from "../../ports/settlementGateway.js";

const NOT_IMPLEMENTED = "BlindPay settlement not implemented — see settlement module POC";

/**
 * BlindPay PIX settlement stub — reserved for settlement module POC (FR-14).
 * No routes call this yet; throws on every method.
 */
export function createBlindPaySettlementGateway(_config: AppConfig): SettlementGateway {
  return {
    async initiatePixPayment(_req: PixPaymentRequest): Promise<{ providerPaymentId: string }> {
      throw new Error(NOT_IMPLEMENTED);
    },
    async getPaymentStatus(
      _providerPaymentId: string,
    ): Promise<"pending" | "completed" | "failed"> {
      throw new Error(NOT_IMPLEMENTED);
    },
  };
}
