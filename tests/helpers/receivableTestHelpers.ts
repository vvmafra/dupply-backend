import { eq } from "drizzle-orm";

import type { AppDeps } from "../../src/compose/deps.js";
import { createAppDeps } from "../../src/compose/deps.js";
import { executeCreateReceivable } from "../../src/modules/receivable/application/commands/createReceivableCommand.js";
import { loadConfig } from "../../src/infra/env/config.js";
import { createDb, runMigrations, type DbHandle } from "../../src/infra/database/index.js";
import { sellers } from "../../src/infra/database/schema.runtime.js";
import type { ReceivableMetaData } from "../../src/modules/receivable/domain/types.js";
import {
  completeCompanyMetaData,
  insertAccount,
} from "./sellerTestHelpers.js";
import { createGateways } from "../../src/infra/gateways/factories/createGateways.js";

export { completeCompanyMetaData };

export const PAYER_CNPJ = "98765432000100";

export const completeReceivableMetaData: ReceivableMetaData = {
  type: "commercial",
  billNumber: "BILL-001",
  invoiceNumber: "INV-001",
  issuedAt: "2025-01-01",
  dueDate: "2025-06-01",
  payerCnpj: PAYER_CNPJ,
  payerLegalName: "Payer Corp LTDA",
  payerFinancialEmail: "finance@payer.com",
  fiscalDocumentType: "nfe",
  fiscalDocumentKey: "35250112345678000195550010000000011234567890",
  proofType: "delivery",
  payerAcceptanceStatus: "accepted",
  desiredAnticipationValue: 500,
  antifraudDeclarationsAccepted: true,
};

export async function createTestContext(): Promise<{ deps: AppDeps; handle: DbHandle }> {
  const handle = createDb("file::memory:");
  await runMigrations(handle);
  const config = loadConfig({ DATABASE_URL: "file::memory:" });
  return { deps: createAppDeps({ db: handle.db, config, gateways: createGateways(config) }), handle };
}

export async function setupActiveSeller(deps: AppDeps): Promise<{
  accountId: string;
  sellerId: string;
  email: string;
}> {
  const { id: accountId, email, sellerId } = await insertAccount(deps);
  if (!sellerId) throw new Error("expected sellerId");
  await deps.db
    .update(sellers)
    .set({
      status: "active",
      companyMetaData: JSON.stringify(completeCompanyMetaData),
      updatedAt: new Date(),
    })
    .where(eq(sellers.id, sellerId));
  return { accountId, sellerId, email };
}

export async function createDraftReceivable(
  deps: AppDeps,
  sellerId: string,
  overrides: {
    payerCnpj?: string;
    payerLegalName?: string;
    payerFinancialEmail?: string;
    value?: number;
    receivableMetaData?: Partial<ReceivableMetaData>;
  } = {},
): Promise<string> {
  const result = await executeCreateReceivable(deps, {
    profileId: sellerId,
    payerCnpj: overrides.payerCnpj ?? PAYER_CNPJ,
    payerLegalName: overrides.payerLegalName ?? "Payer Corp LTDA",
    payerFinancialEmail: overrides.payerFinancialEmail ?? "finance@payer.com",
    value: overrides.value ?? 500,
    receivableMetaData: overrides.receivableMetaData,
  });
  return result.id;
}
