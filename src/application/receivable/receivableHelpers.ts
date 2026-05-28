import { and, eq, isNull } from "drizzle-orm";

import type { AppDeps } from "../deps.js";
import { payers, receivables } from "../../db/schema.runtime.js";
import {
  deriveMaterializedBusinessKeys,
  normalizeReceivableMetaDataForStorage,
  type MaterializedBusinessKeys,
} from "../../domain/receivable/businessKey.js";
import { parseReceivableMetaData } from "../../domain/receivable/metadata.js";
import { RECEIVABLE_ERROR_CODES, ReceivableError } from "../../domain/receivable/errors.js";
import type { ReceivableMetaData, ReceivableRow } from "../../domain/receivable/types.js";
import { toCents, toReais } from "../../shared/money.js";

export type ReceivableDbRow = typeof receivables.$inferSelect;

export function valueReaisToDbCentsText(reais?: number): string {
  if (reais === undefined) return "0";
  return String(toCents(reais));
}

export function valueDbCentsTextToReais(centsText: string): number {
  const cents = Number.parseInt(centsText, 10);
  if (Number.isNaN(cents)) return 0;
  return toReais(cents);
}

export function metaApiToStored(meta: Partial<ReceivableMetaData>): Partial<ReceivableMetaData> {
  const out = { ...meta };
  if (out.desiredAnticipationValue !== undefined) {
    out.desiredAnticipationValue = toCents(out.desiredAnticipationValue);
  }
  return out;
}

export function metaStoredToApi(meta: ReceivableMetaData): ReceivableMetaData {
  const out = { ...meta };
  if (out.desiredAnticipationValue !== undefined) {
    out.desiredAnticipationValue = toReais(out.desiredAnticipationValue);
  }
  return out;
}

export function stringifyReceivableMetaData(meta: Partial<ReceivableMetaData>): string {
  return JSON.stringify(normalizeReceivableMetaDataForStorage(metaApiToStored(meta)));
}

export function prepareReceivableMetaDataForWrite(
  meta: Partial<ReceivableMetaData>,
): { receivableMetaData: string; materializedKeys: MaterializedBusinessKeys } {
  const normalized = normalizeReceivableMetaDataForStorage(metaApiToStored(meta));
  return {
    receivableMetaData: JSON.stringify(normalized),
    materializedKeys: deriveMaterializedBusinessKeys(normalized),
  };
}

export function mapReceivableMetaDataForApi(raw: string | null): string | null {
  if (!raw) return null;
  const meta = parseReceivableMetaData(raw);
  if (!meta) return raw;
  return JSON.stringify(metaStoredToApi(meta));
}

export function mapReceivableRow(row: ReceivableDbRow): ReceivableRow {
  return {
    id: row.id,
    status: row.status,
    sellerId: row.sellerId,
    payerId: row.payerId,
    receivableMetaData: mapReceivableMetaDataForApi(row.receivableMetaData),
    value: valueDbCentsTextToReais(row.value),
    proposedValue:
      row.proposedValue == null ? null : valueDbCentsTextToReais(row.proposedValue),
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
