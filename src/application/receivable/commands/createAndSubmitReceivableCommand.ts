import { createId } from "@paralleldrive/cuid2";

import type { AppDeps } from "../../deps.js";
import { receivables } from "../../../db/schema.runtime.js";
import { upsertPayerByCnpj } from "../../payer/commands/upsertPayerByCnpj.js";
import { parseJson, loadSellerOrThrow } from "../../seller/sellerHelpers.js";
import { assertReceivableMetaDataComplete } from "../../../domain/receivable/metadata.js";
import { assertSellerPayerCnpjDiffer } from "../../../domain/receivable/policies.js";
import {
  assertReceivableTransition,
  RECEIVABLE_STATUS,
} from "../../../domain/receivable/transitions.js";
import type { ReceivableMetaData } from "../../../domain/receivable/types.js";
import { stringifyReceivableMetaData, valueReaisToDbCentsText } from "../receivableHelpers.js";
import { assertSellerCanCreateReceivable } from "../../../domain/seller/policies.js";
import type { CompanyMetaData } from "../../../domain/seller/types.js";

export type CreateAndSubmitReceivableInput = {
  profileId: string;
  payerCnpj: string;
  payerLegalName?: string;
  payerFinancialEmail?: string;
  value?: number;
  receivableMetaData?: Partial<ReceivableMetaData>;
  actorRole?: string;
};

export async function executeCreateAndSubmitReceivable(
  deps: AppDeps,
  input: CreateAndSubmitReceivableInput,
): Promise<{ id: string; status: typeof RECEIVABLE_STATUS.UNDER_REVIEW }> {
  const seller = await loadSellerOrThrow(deps, input.profileId);
  assertSellerCanCreateReceivable({
    status: seller.status as "created" | "in_review" | "active" | "inactive",
    deletedAt: seller.deletedAt,
  });

  const company = parseJson<CompanyMetaData>(seller.companyMetaData);
  assertSellerPayerCnpjDiffer(company.cnpj ?? "", input.payerCnpj);

  const meta = input.receivableMetaData ?? {};
  const mergedMeta = {
    ...meta,
    payerCnpj: input.payerCnpj.replace(/\D/g, ""),
    payerLegalName: input.payerLegalName ?? meta.payerLegalName,
    payerFinancialEmail: input.payerFinancialEmail ?? meta.payerFinancialEmail,
  };
  const receivableMetaData = stringifyReceivableMetaData(mergedMeta);
  const validated = assertReceivableMetaDataComplete(receivableMetaData);

  const actorRole = input.actorRole ?? "seller";
  assertReceivableTransition(null, RECEIVABLE_STATUS.CREATED, {
    kind: "user",
    role: actorRole,
  });
  assertReceivableTransition(RECEIVABLE_STATUS.CREATED, RECEIVABLE_STATUS.UNDER_REVIEW, {
    kind: "user",
    role: actorRole,
  });

  const { payerId } = await upsertPayerByCnpj(deps, {
    cnpj: input.payerCnpj,
    legalName: validated.payerLegalName,
    email: validated.payerFinancialEmail,
  });

  const id = createId();
  const now = new Date();

  await deps.db.insert(receivables).values({
    id,
    sellerId: seller.id,
    payerId,
    status: RECEIVABLE_STATUS.UNDER_REVIEW,
    value: valueReaisToDbCentsText(input.value),
    receivableMetaData,
    proposedValue: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  return { id, status: RECEIVABLE_STATUS.UNDER_REVIEW };
}
