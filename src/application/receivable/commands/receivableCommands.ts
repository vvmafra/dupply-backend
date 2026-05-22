import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { platformUsers, receivables } from "../../../db/schema.runtime.js";
import {
  assertReceivableTransition,
  PLATFORM_ROLES,
  RECEIVABLE_STATUS,
  type ReceivableStatus,
} from "../../../domain/receivable/transitions.js";

function nowMs(): string {
  return String(Date.now());
}

export type CreateReceivableInput = {
  sellerUserId: string;
  payerUserId: string;
  value: string;
  receivableMd?: string | undefined;
};

export async function executeCreateReceivable(
  deps: AppDeps,
  input: CreateReceivableInput,
): Promise<{ id: string }> {
  const { db } = deps;
  if (input.sellerUserId === input.payerUserId) {
    throw new Error("seller_and_payer_must_differ");
  }
  const [seller] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.id, input.sellerUserId))
    .limit(1);
  if (!seller || seller.role !== PLATFORM_ROLES.SELLER) {
    throw new Error("invalid_seller");
  }
  const [payer] = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.id, input.payerUserId))
    .limit(1);
  if (!payer || payer.role !== PLATFORM_ROLES.PAYER) {
    throw new Error("invalid_payer");
  }
  const id = randomUUID();
  const t = nowMs();
  await db.insert(receivables).values({
    id,
    sellerUserId: input.sellerUserId,
    payerUserId: input.payerUserId,
    status: RECEIVABLE_STATUS.UNDER_REVIEW,
    value: input.value,
    receivableMd: input.receivableMd ?? null,
    createdAtMs: t,
    updatedAtMs: t,
  });
  return { id };
}

export type RiskDecisionInput = {
  receivableId: string;
  actorRole: string;
  decision: "offer" | "reject";
  proposedValue?: string | undefined;
};

export async function executeRiskDecision(deps: AppDeps, input: RiskDecisionInput): Promise<void> {
  const { db } = deps;
  const [row] = await db
    .select()
    .from(receivables)
    .where(eq(receivables.id, input.receivableId))
    .limit(1);
  if (!row) {
    throw new Error("receivable_not_found");
  }
  const from = row.status as ReceivableStatus;
  if (from !== RECEIVABLE_STATUS.UNDER_REVIEW) {
    throw new Error("invalid_status_for_risk_decision");
  }
  const to =
    input.decision === "offer" ? RECEIVABLE_STATUS.OFFER : RECEIVABLE_STATUS.REJECTED;
  assertReceivableTransition(from, to, { kind: "user", role: input.actorRole });
  if (to === RECEIVABLE_STATUS.OFFER) {
    if (!input.proposedValue?.trim()) {
      throw new Error("proposed_value_required_for_offer");
    }
  }
  await db
    .update(receivables)
    .set({
      status: to,
      proposedValue: to === RECEIVABLE_STATUS.OFFER ? input.proposedValue!.trim() : null,
      updatedAtMs: nowMs(),
    })
    .where(eq(receivables.id, input.receivableId));
}

export type PayerConfirmInput = {
  receivableId: string;
  payerUserId: string;
};

export async function executePayerConfirm(deps: AppDeps, input: PayerConfirmInput): Promise<void> {
  const { db } = deps;
  const [row] = await db
    .select()
    .from(receivables)
    .where(eq(receivables.id, input.receivableId))
    .limit(1);
  if (!row) {
    throw new Error("receivable_not_found");
  }
  if (row.payerUserId !== input.payerUserId) {
    throw new Error("payer_mismatch");
  }
  const from = row.status as ReceivableStatus;
  const to = RECEIVABLE_STATUS.CONFIRMED;
  assertReceivableTransition(from, to, { kind: "user", role: PLATFORM_ROLES.PAYER });
  await db
    .update(receivables)
    .set({ status: to, updatedAtMs: nowMs() })
    .where(eq(receivables.id, input.receivableId));
}

export type SystemAdvanceInput = {
  receivableId: string;
  targetStatus: typeof RECEIVABLE_STATUS.PROCESSING | typeof RECEIVABLE_STATUS.COMPLETED;
};

export async function executeSystemAdvanceSettlement(
  deps: AppDeps,
  input: SystemAdvanceInput,
): Promise<void> {
  const { db } = deps;
  const [row] = await db
    .select()
    .from(receivables)
    .where(eq(receivables.id, input.receivableId))
    .limit(1);
  if (!row) {
    throw new Error("receivable_not_found");
  }
  const from = row.status as ReceivableStatus;
  assertReceivableTransition(from, input.targetStatus, { kind: "system" });
  await db
    .update(receivables)
    .set({ status: input.targetStatus, updatedAtMs: nowMs() })
    .where(eq(receivables.id, input.receivableId));
}
