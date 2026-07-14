import type { AppConfig } from "../../env/config.js";
import type { RegistryGateway } from "../ports/registryGateway.js";
import type { RampGateway } from "../ports/rampGateway.js";
import type { SettlementGateway } from "../ports/settlementGateway.js";
import { createStellarRegistryGateway } from "../providers/stellar/stellarRegistryGateway.js";
import { createEtherfuseRampGateway } from "../providers/etherfuse/etherfuseRampGateway.js";
import { createBlindPaySettlementGateway } from "../providers/blindpay/blindPaySettlementGateway.js";

export type Gateways = {
  registry: RegistryGateway;
  ramp: RampGateway;
  settlement: SettlementGateway;
};

export function createGateways(config: AppConfig): Gateways {
  return {
    registry: createStellarRegistryGateway(config),
    ramp: createEtherfuseRampGateway(config),
    settlement: createBlindPaySettlementGateway(config),
  };
}
