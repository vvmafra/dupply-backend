import { createId } from "@paralleldrive/cuid2";
import argon2 from "argon2";

import type { AppDeps } from "../../src/application/deps.js";
import { accounts, sellers } from "../../src/db/schema.runtime.js";
import {
  EMPTY_BUSINESS_RELATIONS_METADATA,
  EMPTY_COMPANY_METADATA,
  EMPTY_LEGAL_REP_METADATA,
} from "../../src/domain/seller/types.js";

export const TEST_PASSWORD = "test-password-123";

export async function insertAccount(
  deps: AppDeps,
  overrides: Partial<typeof accounts.$inferInsert> = {},
): Promise<{ id: string; email: string; sellerId?: string }> {
  const id = createId();
  const email = overrides.email ?? `user-${id}@example.com`;
  const passwordHash = overrides.passwordHash ?? (await argon2.hash(TEST_PASSWORD));
  const now = new Date();
  const role = overrides.role ?? "seller";

  await deps.db.insert(accounts).values({
    id,
    email,
    passwordHash,
    role,
    status: "active",
    refreshToken: null,
    refreshTokenLookup: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });

  let sellerId: string | undefined;
  if (role === "seller") {
    sellerId = createId();
    await deps.db.insert(sellers).values({
      id: sellerId,
      name: "Test Seller",
      status: "created",
      accountId: id,
      companyMetaData: EMPTY_COMPANY_METADATA,
      legalRepresentativeMetaData: EMPTY_LEGAL_REP_METADATA,
      businessRelationsMetaData: EMPTY_BUSINESS_RELATIONS_METADATA,
      walletId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  return { id, email, sellerId };
}

export const completeCompanyMetaData = {
  legalName: "Empresa Teste LTDA",
  cnpj: "12345678000195",
  foundingDate: "2020-01-15",
  shareCapital: 150000.0,
  annualRevenue: 5000000.0,
  corporateEmail: "contato@empresa.com",
  phone: "41999449944",
  businessDescription: "Comércio de produtos",
  address: {
    zipCode: "80010000",
    state: "PR",
    street: "Rua Teste",
    number: "100",
    neighborhood: "Centro",
    city: "Curitiba",
  },
};

export const completeLegalRepMetaData = {
  fullName: "João Silva",
  cpf: "12345678901",
  email: "joao@empresa.com",
  phone: "41999887766",
  role: "Sócio Administrador",
};

export const completeBusinessRelationsMetaData = {
  clients: [{ legalName: "Cliente A", cnpj: "12345678000195" }],
  suppliers: [{ legalName: "Fornecedor B", cnpj: "98765432000100" }],
};
