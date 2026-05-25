import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../deps.js";
import { payers, receivables } from "../../db/schema.runtime.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../domain/receivable/errors.js";
import type { ReceivableRow } from "../../domain/receivable/types.js";

export type ReceivableDbRow = typeof receivables.$inferSelect;

export function mapReceivableRow(row: ReceivableDbRow): ReceivableRow {
  return {
    id: row.id,
    status: row.status,
    sellerId: row.sellerId,
    payerId: row.payerId,
    receivableMetaData: row.receivableMetaData,
    value: row.value,
    proposedValue: row.proposedValue,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export async function loadReceivableOrThrow(
  deps: AppDeps,
  receivableId: string,
): Promise<ReceivableDbRow> {
  const [row] = await deps.db
    .select()
    .from(receivables)
    .where(and(eq(receivables.id, receivableId), isNull(receivables.deletedAt)))
    .limit(1);
  if (!row) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.NOT_FOUND);
  }
  return row;
}

export async function findPayerByCnpj(deps: AppDeps, cnpj: string) {
  const normalized = cnpj.replace(/\D/g, "");
  const [row] = await deps.db
    .select()
    .from(payers)
    .where(eq(payers.cnpj, normalized))
    .limit(1);
  return row ?? null;
}
