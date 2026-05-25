import type { RegisterSellerWalletPayload } from "../../src/domain/wallet/validators.js";

export const VALID_CONTRACT_ID =
  "CABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
export const VALID_CONTRACT_ID_ALT =
  "CABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVX";
export const VALID_SIGNER_PUBLIC_KEY = "04" + "a".repeat(128);

export function validRegisterWalletPayload(
  overrides: Partial<RegisterSellerWalletPayload> = {},
): RegisterSellerWalletPayload {
  return {
    contractId: VALID_CONTRACT_ID,
    credentialId: "cred-base64url-id",
    signerPublicKey: VALID_SIGNER_PUBLIC_KEY,
    network: "testnet",
    ...overrides,
  };
}
