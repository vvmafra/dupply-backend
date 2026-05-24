export const ACCOUNT_ROLES = [
  "seller",
  "payer",
  "risk_analyst",
  "risk_analyst_agent",
  "admin",
] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "inactive"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Fields loaded for auth flows (login / refresh). */
export type AccountAuthSnapshot = {
  id: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  passwordHash: string;
  refreshToken: string | null;
  deletedAt: Date | null;
};

/** Safe API representation — no secrets. */
export type AccountPublicView = {
  id: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
};
