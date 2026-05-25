import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { sellers } from "../../../db/schema.runtime.js";
import type { AccountRole } from "../../../domain/account/types.js";
import { assertSellerStatusTransition } from "../../../domain/seller/transitions.js";
import type { SellerStatus } from "../../../domain/seller/types.js";
import { loadSellerOrThrow } from "../sellerHelpers.js";

export type TransitionSellerStatusInput = {
  sellerId: string;
  targetStatus: "active" | "inactive";
  actor: { role: AccountRole };
};

export async function executeTransitionSellerStatus(
  deps: AppDeps,
  input: TransitionSellerStatusInput,
): Promise<void> {
  const seller = await loadSellerOrThrow(deps, input.sellerId);
  const from = seller.status as SellerStatus;
  const actorKind =
    from === "in_review"
      ? { kind: "reviewer" as const, role: input.actor.role as "admin" | "risk_analyst" }
      : { kind: "admin" as const };
  assertSellerStatusTransition(from, input.targetStatus, actorKind);

  await deps.db
    .update(sellers)
    .set({ status: input.targetStatus, updatedAt: new Date() })
    .where(eq(sellers.id, input.sellerId));
}
