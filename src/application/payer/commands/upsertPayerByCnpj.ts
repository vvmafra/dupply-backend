import { createId } from "@paralleldrive/cuid2";

import type { AppDeps } from "../../deps.js";
import { payers } from "../../../db/schema.runtime.js";
import { PAYER_ERROR_CODES, PayerError } from "../../../domain/payer/errors.js";
import { findPayerByCnpj } from "../../receivable/receivableHelpers.js";

export type UpsertPayerInput = {
  cnpj: string;
  legalName: string;
  email: string;
};

export async function upsertPayerByCnpj(
  deps: AppDeps,
  input: UpsertPayerInput,
): Promise<{ payerId: string; created: boolean }> {
  const cnpj = input.cnpj.replace(/\D/g, "");
  const existing = await findPayerByCnpj(deps, cnpj);
  if (existing) {
    if (existing.deletedAt !== null || existing.status !== "active") {
      throw new PayerError(PAYER_ERROR_CODES.INACTIVE);
    }
    return { payerId: existing.id, created: false };
  }

  if (!input.legalName.trim() || !input.email.trim()) {
    throw new PayerError(PAYER_ERROR_CODES.MISSING_FIELDS);
  }

  const id = createId();
  const now = new Date();
  await deps.db.insert(payers).values({
    id,
    cnpj,
    legalName: input.legalName.trim(),
    email: input.email.trim(),
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  return { payerId: id, created: true };
}
