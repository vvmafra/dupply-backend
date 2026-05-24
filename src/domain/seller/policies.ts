import type { AccountRole } from "../account/types.js";
import { SELLER_ERROR_CODES, SellerError } from "./errors.js";
import type { SellerStatus } from "./types.js";

export function assertCanReadSeller(
  actor: { sub: string; role: AccountRole; profileId: string },
  seller: { id: string; accountId: string; status: SellerStatus; deletedAt: Date | null },
): void {
  if (seller.deletedAt !== null) {
    throw new SellerError(SELLER_ERROR_CODES.NOT_FOUND);
  }
  if (actor.profileId === seller.id || actor.role === "admin") return;
  if (actor.role === "risk_analyst" && seller.status === "in_review") return;
  throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
}

export function assertCanUpdateSellerMetadata(
  actor: { profileId: string },
  seller: { id: string; status: SellerStatus },
): void {
  if (actor.profileId !== seller.id) {
    throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
  }
  if (seller.status !== "created") {
    throw new SellerError(SELLER_ERROR_CODES.METADATA_LOCKED);
  }
}

export function assertCanSubmitForReview(
  actor: { profileId: string },
  seller: { id: string; status: SellerStatus },
): void {
  if (actor.profileId !== seller.id) {
    throw new SellerError(SELLER_ERROR_CODES.FORBIDDEN);
  }
  if (seller.status !== "created") {
    throw new SellerError(SELLER_ERROR_CODES.INVALID_STATUS_FOR_SUBMIT);
  }
}

export function assertSellerCanCreateReceivable(seller: {
  status: SellerStatus;
  deletedAt: Date | null;
}): void {
  if (seller.deletedAt !== null || seller.status !== "active") {
    throw new SellerError(SELLER_ERROR_CODES.NOT_ACTIVE);
  }
}
