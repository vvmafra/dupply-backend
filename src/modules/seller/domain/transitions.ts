import { SELLER_ERROR_CODES, SellerError } from "./errors.js";
import type { SellerStatus } from "./types.js";

export type StatusTransitionActor =
  | { kind: "seller"; accountId: string }
  | { kind: "reviewer"; role: "admin" | "risk_analyst" }
  | { kind: "admin" };

export function assertSellerStatusTransition(
  from: SellerStatus,
  to: SellerStatus,
  actor: StatusTransitionActor,
): void {
  if (from === "created" && to === "in_review") {
    if (actor.kind !== "seller") {
      throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
    }
    return;
  }

  if (from === "in_review" && (to === "active" || to === "inactive")) {
    if (actor.kind !== "reviewer") {
      throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
    }
    return;
  }

  if (from === "active" && to === "inactive") {
    if (actor.kind !== "admin") {
      throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
    }
    return;
  }

  if (from === "inactive" && to === "active") {
    if (actor.kind !== "admin") {
      throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
    }
    return;
  }

  throw new SellerError(SELLER_ERROR_CODES.INVALID_STATUS_TRANSITION);
}
