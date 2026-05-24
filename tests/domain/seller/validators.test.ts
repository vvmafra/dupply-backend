import assert from "node:assert/strict";
import test from "node:test";

import { SELLER_ERROR_CODES, SellerError } from "../../../src/domain/seller/errors.js";
import {
  assertCompleteSellerMetadata,
  assertValidBusinessRelations,
  assertValidCnpj,
  assertValidCpf,
  assertValidFoundingDate,
  assertValidPhone,
} from "../../../src/domain/seller/validators.js";
import type {
  BusinessRelationsMetaData,
  CompanyMetaData,
  LegalRepresentativeMetaData,
} from "../../../src/domain/seller/types.js";

const validCompany: CompanyMetaData = {
  legalName: "Empresa Teste LTDA",
  cnpj: "12345678000195",
  foundingDate: "2020-01-15",
  shareCapital: 15000000,
  annualRevenue: 500000000,
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

const validLegal: LegalRepresentativeMetaData = {
  fullName: "João Silva",
  cpf: "12345678901",
  email: "joao@empresa.com",
  phone: "41999887766",
  role: "Sócio Administrador",
};

const validRelations: BusinessRelationsMetaData = {
  clients: [{ legalName: "Cliente A", cnpj: "12345678000195" }],
  suppliers: [{ legalName: "Fornecedor B", cnpj: "98765432000100" }],
};

test("assertValidCnpj accepts 14 digits", () => {
  assert.doesNotThrow(() => assertValidCnpj("12345678000195"));
});

test("assertValidCnpj rejects 13 digits", () => {
  assert.throws(() => assertValidCnpj("1234567800019"), (e: unknown) => {
    assert.ok(e instanceof SellerError);
    assert.equal(e.code, SELLER_ERROR_CODES.VALIDATION_ERROR);
    return true;
  });
});

test("assertValidCnpj rejects formatted CNPJ", () => {
  assert.throws(() => assertValidCnpj("12.345.678/0001-95"), SellerError);
});

test("assertValidCpf accepts 11 digits", () => {
  assert.doesNotThrow(() => assertValidCpf("12345678901"));
});

test("assertValidPhone rejects formatted phone", () => {
  assert.throws(() => assertValidPhone("(41) 99944-9944"), (e: unknown) => {
    assert.ok(e instanceof SellerError);
    assert.equal(e.code, SELLER_ERROR_CODES.VALIDATION_ERROR);
    return true;
  });
});

test("assertValidFoundingDate accepts ISO date", () => {
  assert.doesNotThrow(() => assertValidFoundingDate("2020-01-15"));
});

test("assertValidFoundingDate rejects invalid format", () => {
  assert.throws(() => assertValidFoundingDate("15/01/2020"), SellerError);
});

test("assertValidBusinessRelations rejects 0 clients", () => {
  assert.throws(
    () =>
      assertValidBusinessRelations({
        clients: [],
        suppliers: [{ legalName: "X", cnpj: "12345678000195" }],
      }),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.VALIDATION_ERROR);
      return true;
    },
  );
});

test("assertValidBusinessRelations rejects 6 clients", () => {
  const clients = Array.from({ length: 6 }, (_, i) => ({
    legalName: `Cliente ${i}`,
    cnpj: "12345678000195",
  }));
  assert.throws(
    () => assertValidBusinessRelations({ clients, suppliers: validRelations.suppliers }),
    SellerError,
  );
});

test("assertCompleteSellerMetadata passes with valid data", () => {
  assert.doesNotThrow(() =>
    assertCompleteSellerMetadata(validCompany, validLegal, validRelations),
  );
});

test("assertCompleteSellerMetadata throws incomplete_metadata for missing legalName", () => {
  assert.throws(
    () =>
      assertCompleteSellerMetadata(
        { ...validCompany, legalName: "" },
        validLegal,
        validRelations,
      ),
    (e: unknown) => {
      assert.ok(e instanceof SellerError);
      assert.equal(e.code, SELLER_ERROR_CODES.INCOMPLETE_METADATA);
      return true;
    },
  );
});
