import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import type { AppDeps } from "../../deps.js";
import { receivables } from "../../../db/schema.runtime.js";
import { parseJson, loadSellerOrThrow } from "../../seller/sellerHelpers.js";
import { upsertPayerByCnpj } from "../../payer/commands/upsertPayerByCnpj.js";
import type { CompanyMetaData } from "../../../domain/seller/types.js";
import { assertSellerCanCreateReceivable } from "../../../domain/seller/policies.js";
import { assertSellerPayerCnpjDiffer } from "../../../domain/receivable/policies.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
} from "../../../domain/receivable/transitions.js";
import type { ReceivableMetaData } from "../../../domain/receivable/types.js";

export type CreateReceivableInput = {
  profileId: string;
  payerCnpj: string;
  payerLegalName?: string;
  payerFinancialEmail?: string;
  value?: string;
  receivableMetaData?: Partial<ReceivableMetaData>;
};

export async function executeCreateReceivable(
  deps: AppDeps,
  input: CreateReceivableInput,
): Promise<{ id: string }> {
  const seller = await loadSellerOrThrow(deps, input.profileId);
  assertSellerCanCreateReceivable({
    status: seller.status as "created" | "in_review" | "active" | "inactive",
    deletedAt: seller.deletedAt,
  });

  const company = parseJson<CompanyMetaData>(seller.companyMetaData);
  assertSellerPayerCnpjDiffer(company.cnpj ?? "", input.payerCnpj);

  const meta = input.receivableMetaData ?? {};
  const payerLegalName = input.payerLegalName ?? meta.payerLegalName ?? "";
  const payerFinancialEmail = input.payerFinancialEmail ?? meta.payerFinancialEmail ?? "";

  const { payerId } = await upsertPayerByCnpj(deps, {
    cnpj: input.payerCnpj,
    legalName: payerLegalName,
    email: payerFinancialEmail,
  });

  assertReceivableTransition(null, RECEIVABLE_STATUS.CREATED, {
    kind: "user",
    role: "seller",
  });

  const id = createId();
  const now = new Date();
  const receivableMetaData =
    input.receivableMetaData !== undefined
      ? JSON.stringify({ ...meta, payerCnpj: input.payerCnpj.replace(/\D/g, "") })
      : null;

  await deps.db.insert(receivables).values({
    id,
    sellerId: seller.id,
    payerId,
    status: RECEIVABLE_STATUS.CREATED,
    value: input.value?.trim() || "0",
    receivableMetaData,
    proposedValue: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  return { id };
}
