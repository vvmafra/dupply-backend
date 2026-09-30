import { SELLER_ERROR_CODES, SellerError } from "./errors.js";
import type {
  BusinessRelationsMetaData,
  CompanyMetaData,
  LegalRepresentativeMetaData,
} from "./types.js";

const DIGITS_ONLY = /^\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validationError(): never {
  throw new SellerError(SELLER_ERROR_CODES.VALIDATION_ERROR);
}

function incompleteMetadata(): never {
  throw new SellerError(SELLER_ERROR_CODES.INCOMPLETE_METADATA);
}

function assertNonEmpty(value: string | undefined): asserts value is string {
  if (!value?.trim()) {
    incompleteMetadata();
  }
}

export function assertValidCnpj(cnpj: string): void {
  if (!DIGITS_ONLY.test(cnpj) || cnpj.length !== 14) {
    validationError();
  }
}

export function assertValidCpf(cpf: string): void {
  if (!DIGITS_ONLY.test(cpf) || cpf.length !== 11) {
    validationError();
  }
}

export function assertValidPhone(phone: string): void {
  if (!DIGITS_ONLY.test(phone) || phone.length < 10) {
    validationError();
  }
}

export function assertValidFoundingDate(date: string): void {
  if (!ISO_DATE.test(date)) {
    validationError();
  }
}

export function assertValidAddress(address: CompanyMetaData["address"]): void {
  if (!DIGITS_ONLY.test(address.zipCode) || address.zipCode.length !== 8) {
    validationError();
  }
  if (address.state.length !== 2) {
    validationError();
  }
  assertNonEmpty(address.street);
  assertNonEmpty(address.number);
  assertNonEmpty(address.neighborhood);
  assertNonEmpty(address.city);
}

export function assertValidBusinessRelations(data: BusinessRelationsMetaData): void {
  if (data.clients.length < 1 || data.clients.length > 5) {
    validationError();
  }
  if (data.suppliers.length < 1 || data.suppliers.length > 5) {
    validationError();
  }
  for (const rel of [...data.clients, ...data.suppliers]) {
    assertNonEmpty(rel.legalName);
    assertValidCnpj(rel.cnpj);
  }
}

export function assertCompleteSellerMetadata(
  company: CompanyMetaData,
  legal: LegalRepresentativeMetaData,
  relations: BusinessRelationsMetaData,
): void {
  assertNonEmpty(company.legalName);
  assertValidCnpj(company.cnpj);
  assertValidFoundingDate(company.foundingDate);
  if (company.shareCapital == null || company.shareCapital < 0) {
    incompleteMetadata();
  }
  if (company.annualRevenue == null || company.annualRevenue < 0) {
    incompleteMetadata();
  }
  assertNonEmpty(company.corporateEmail);
  assertValidPhone(company.phone);
  assertNonEmpty(company.businessDescription);
  if (!company.address) {
    incompleteMetadata();
  }
  assertValidAddress(company.address);

  assertNonEmpty(legal.fullName);
  assertValidCpf(legal.cpf);
  assertNonEmpty(legal.email);
  assertValidPhone(legal.phone);
  assertNonEmpty(legal.role);

  assertValidBusinessRelations(relations);
}

export function validatePartialCompanyMetaData(data: Partial<CompanyMetaData>): void {
  if (data.cnpj !== undefined) assertValidCnpj(data.cnpj);
  if (data.foundingDate !== undefined) assertValidFoundingDate(data.foundingDate);
  if (data.phone !== undefined) assertValidPhone(data.phone);
  if (data.address !== undefined) assertValidAddress(data.address);
}

export function validatePartialLegalRepMetaData(data: Partial<LegalRepresentativeMetaData>): void {
  if (data.cpf !== undefined) assertValidCpf(data.cpf);
  if (data.phone !== undefined) assertValidPhone(data.phone);
}

export function validatePartialBusinessRelationsMetaData(
  data: Partial<BusinessRelationsMetaData>,
): void {
  if (data.clients !== undefined || data.suppliers !== undefined) {
    assertValidBusinessRelations({
      clients: data.clients ?? [],
      suppliers: data.suppliers ?? [],
    });
  }
}
