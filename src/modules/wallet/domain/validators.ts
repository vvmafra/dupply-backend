import { WALLET_ERROR_CODES, WalletError } from "./errors.js";
import { WALLET_NETWORKS, type WalletNetwork } from "./types.js";

/** Soroban contract IDs start with 'C' and are 56 chars (Stellar strkey). */
const SOROBAN_CONTRACT_ID = /^C[A-Z2-7]{55}$/;

/** 65-byte secp256r1 uncompressed public key as 130-char hex (0x04 prefix optional). */
const SIGNER_PUBLIC_KEY_HEX = /^(0x)?[0-9a-fA-F]{128,130}$/;

export type RegisterSellerWalletPayload = {
  contractId: string;
  credentialId: string;
  signerPublicKey: string;
  network: WalletNetwork;
  createdTxHash?: string;
};

export function assertValidSellerSmartAccountWallet(
  input: RegisterSellerWalletPayload,
): void {
  if (!SOROBAN_CONTRACT_ID.test(input.contractId)) {
    throw new WalletError(WALLET_ERROR_CODES.VALIDATION_ERROR);
  }
  if (!input.credentialId.trim()) {
    throw new WalletError(WALLET_ERROR_CODES.VALIDATION_ERROR);
  }
  if (!SIGNER_PUBLIC_KEY_HEX.test(input.signerPublicKey)) {
    throw new WalletError(WALLET_ERROR_CODES.VALIDATION_ERROR);
  }
  if (!WALLET_NETWORKS.includes(input.network)) {
    throw new WalletError(WALLET_ERROR_CODES.VALIDATION_ERROR);
  }
}
