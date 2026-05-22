/** Receivable lifecycle — canonical API / DB values (v1). */
export const RECEIVABLE_STATUS = {
  UNDER_REVIEW: "under_review",
  OFFER: "offer",
  REJECTED: "rejected",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
} as const;

export type ReceivableStatus = (typeof RECEIVABLE_STATUS)[keyof typeof RECEIVABLE_STATUS];

export const PLATFORM_ROLES = {
  SELLER: "seller",
  PAYER: "payer",
  ADMIN: "admin",
  RISK_ANALYST: "risk_analyst",
  RISK_ANALYST_AGENT: "risk_analyst_agent",
} as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES];

export type TransitionActor =
  | { kind: "system" }
  | { kind: "user"; role: string };

export class ReceivableTransitionError extends Error {
  readonly code = "invalid_receivable_transition";

  constructor(message = "invalid_receivable_transition") {
    super(message);
    this.name = "ReceivableTransitionError";
  }
}

function isRiskRole(role: string): boolean {
  return role === PLATFORM_ROLES.RISK_ANALYST || role === PLATFORM_ROLES.RISK_ANALYST_AGENT;
}

/**
 * Validates a single status change. Caller must enforce row-level ACL (e.g. payer id).
 */
export function assertReceivableTransition(
  from: ReceivableStatus,
  to: ReceivableStatus,
  actor: TransitionActor,
): void {
  if (to === RECEIVABLE_STATUS.PROCESSING || to === RECEIVABLE_STATUS.COMPLETED) {
    if (actor.kind !== "system") {
      throw new ReceivableTransitionError("processing_and_completed_are_system_only");
    }
    if (from === RECEIVABLE_STATUS.CONFIRMED && to === RECEIVABLE_STATUS.PROCESSING) {
      return;
    }
    if (from === RECEIVABLE_STATUS.PROCESSING && to === RECEIVABLE_STATUS.COMPLETED) {
      return;
    }
    throw new ReceivableTransitionError("invalid_system_transition");
  }

  if (actor.kind !== "user") {
    throw new ReceivableTransitionError("user_actor_required");
  }

  const { role } = actor;

  if (from === RECEIVABLE_STATUS.UNDER_REVIEW) {
    if (to === RECEIVABLE_STATUS.OFFER || to === RECEIVABLE_STATUS.REJECTED) {
      if (!isRiskRole(role)) {
        throw new ReceivableTransitionError("risk_role_required");
      }
      return;
    }
  }

  if (from === RECEIVABLE_STATUS.OFFER && to === RECEIVABLE_STATUS.CONFIRMED) {
    if (role !== PLATFORM_ROLES.PAYER) {
      throw new ReceivableTransitionError("payer_role_required");
    }
    return;
  }

  throw new ReceivableTransitionError("transition_not_allowed");
}

export function isReceivableStatus(value: string): value is ReceivableStatus {
  return (Object.values(RECEIVABLE_STATUS) as string[]).includes(value);
}

export function isPlatformRole(value: string): value is PlatformRole {
  return (Object.values(PLATFORM_ROLES) as string[]).includes(value);
}
