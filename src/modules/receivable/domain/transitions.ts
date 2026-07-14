/** Receivable lifecycle — canonical API / DB values (v2). */
export const RECEIVABLE_STATUS = {
  CREATED: "created",
  UNDER_REVIEW: "under_review",
  REPROVED: "reproved",
  OFFER: "offer",
  REJECTED: "rejected",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  COMPLETED: "completed",
  PAYER_SETTLED: "payer_settled",
  OVERDUE: "overdue",
} as const;

/** Historical DB values — no new transitions; still returned by GET (OQ-3). */
export const LEGACY_RECEIVABLE_STATUSES = {
  APPROVED: "approved",
  PAYER_REJECTED: "payer_rejected",
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

export type TransitionActor = { kind: "system" } | { kind: "user"; role: string };

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

function isSellerRole(role: string): boolean {
  return role === PLATFORM_ROLES.SELLER;
}

/**
 * Validates a single status change. Caller must enforce row-level ACL (e.g. payer id).
 */
export function assertReceivableTransition(
  from: ReceivableStatus | null,
  to: ReceivableStatus,
  actor: TransitionActor,
): void {
  if (from === null && to === RECEIVABLE_STATUS.CREATED) {
    if (actor.kind !== "user" || !isSellerRole(actor.role)) {
      throw new ReceivableTransitionError("seller_role_required");
    }
    return;
  }

  if (from === null) {
    throw new ReceivableTransitionError("transition_not_allowed");
  }

  if (
    to === RECEIVABLE_STATUS.PROCESSING ||
    to === RECEIVABLE_STATUS.COMPLETED ||
    to === RECEIVABLE_STATUS.PAYER_SETTLED ||
    to === RECEIVABLE_STATUS.OVERDUE
  ) {
    if (actor.kind !== "system") {
      throw new ReceivableTransitionError("system_actor_required");
    }
    if (from === RECEIVABLE_STATUS.CONFIRMED && to === RECEIVABLE_STATUS.PROCESSING) {
      return;
    }
    if (from === RECEIVABLE_STATUS.PROCESSING && to === RECEIVABLE_STATUS.COMPLETED) {
      return;
    }
    if (from === RECEIVABLE_STATUS.COMPLETED && to === RECEIVABLE_STATUS.PAYER_SETTLED) {
      return;
    }
    if (from === RECEIVABLE_STATUS.COMPLETED && to === RECEIVABLE_STATUS.OVERDUE) {
      return;
    }
    if (from === RECEIVABLE_STATUS.OVERDUE && to === RECEIVABLE_STATUS.PAYER_SETTLED) {
      return;
    }
    throw new ReceivableTransitionError("invalid_system_transition");
  }

  if (actor.kind !== "user") {
    throw new ReceivableTransitionError("user_actor_required");
  }

  const { role } = actor;

  if (from === RECEIVABLE_STATUS.CREATED && to === RECEIVABLE_STATUS.UNDER_REVIEW) {
    if (!isSellerRole(role)) {
      throw new ReceivableTransitionError("seller_role_required");
    }
    return;
  }

  if (from === RECEIVABLE_STATUS.UNDER_REVIEW) {
    if (to === RECEIVABLE_STATUS.OFFER || to === RECEIVABLE_STATUS.REPROVED) {
      if (!isRiskRole(role)) {
        throw new ReceivableTransitionError("risk_role_required");
      }
      return;
    }
  }

  if (from === RECEIVABLE_STATUS.OFFER) {
    if (to === RECEIVABLE_STATUS.CONFIRMED || to === RECEIVABLE_STATUS.REJECTED) {
      if (!isSellerRole(role)) {
        throw new ReceivableTransitionError("seller_role_required");
      }
      return;
    }
  }

  throw new ReceivableTransitionError("transition_not_allowed");
}

export function isReceivableStatus(value: string): value is ReceivableStatus {
  return (
    (Object.values(RECEIVABLE_STATUS) as string[]).includes(value) ||
    (Object.values(LEGACY_RECEIVABLE_STATUSES) as string[]).includes(value)
  );
}

export function isPlatformRole(value: string): value is PlatformRole {
  return (Object.values(PLATFORM_ROLES) as string[]).includes(value);
}
