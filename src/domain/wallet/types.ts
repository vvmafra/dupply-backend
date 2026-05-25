export const WALLET_STATUSES = ["active", "inactive"] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

export const WALLET_NETWORKS = ["testnet", "mainnet"] as const;
export type WalletNetwork = (typeof WALLET_NETWORKS)[number];

export type WalletPublicView = {
  id: string;
  status: WalletStatus;
  network: WalletNetwork;
  address: string;
  type: "smart_account";
  credentialId: string;
  signerPublicKey: string;
  createdTxHash: string | null;
  parentType: "seller";
  sellerId: string;
  createdAt: Date;
  updatedAt: Date;
};
