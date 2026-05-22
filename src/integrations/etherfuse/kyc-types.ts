/**
 * Etherfuse programmatic KYC types (personal customers).
 * @see https://docs.etherfuse.com/api-reference/kyc/submit-kyc-identity-data
 * @see https://docs.etherfuse.com/guides/onboarding-programmatic
 */

export type KycStatus =
  | "not_started"
  | "proposed"
  | "approved"
  | "approved_chain_deploying"
  | "rejected";

export type KycIdentityName = {
  givenName: string;
  familyName: string;
};

export type KycIdentityAddress = {
  street: string;
  city: string;
  region: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
};

export type KycIdNumber = {
  value: string;
  type: string;
};

export type KycIdentityPayload = {
  /** Identity identifier (Etherfuse expects this; typically the wallet pubkey). */
  id: string;
  name: KycIdentityName;
  dateOfBirth: string;
  address: KycIdentityAddress;
  idNumbers: KycIdNumber[];
};

export type SubmitKycRequest = {
  pubkey?: string;
  identity: KycIdentityPayload;
};

export type SubmitKycResponse = {
  status: string;
  message?: string;
};

export type UploadKycDocumentsRequest = {
  pubkey?: string;
  documentType: "document" | "selfie";
  images: { label: string; image: string }[];
};

export type UploadKycDocumentsResponse = {
  status: string;
  message?: string;
};

export type KycStatusResponse = {
  customerId: string;
  walletPublicKey: string;
  status: KycStatus;
  onChainMarked?: boolean | null;
  currentRejectionReason?: string | null;
  approvedAt?: string | null;
};

export type CreateChildOrganizationRequest = {
  id: string;
  displayName: string;
  accountType: "personal" | "business";
  userInfo?: { email: string; displayName: string };
  wallets?: { publicKey: string; blockchain: string }[];
};

export type CreateChildOrganizationResponse = {
  organizationId: string;
  displayName: string;
  accountType: string;
  wallets?: { id: string; publicKey: string; blockchain: string }[];
};
