import { RECEIVABLE_ERROR_CODES, ReceivableError } from "./errors.js";
import { RECEIVABLE_STATUS } from "./transitions.js";

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export function assertSellerOwnsReceivable(
  actor: { profileId: string },
  receivable: { sellerId: string },
): void {
  if (actor.profileId !== receivable.sellerId) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.NOT_OWNER);
  }
}

export function assertCanUpdateReceivableDraft(receivable: {
  status: string;
  deletedAt: Date | null;
}): void {
  if (receivable.deletedAt !== null) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.SOFT_DELETED);
  }
  if (receivable.status !== RECEIVABLE_STATUS.CREATED) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.METADATA_LOCKED);
  }
}

export function assertCanViewReceivable(
  actor: { profileId: string; role: string },
  receivable: { sellerId: string },
): boolean {
  if (actor.role === "seller") {
    return actor.profileId === receivable.sellerId;
  }
  if (
    actor.role === "risk_analyst" ||
    actor.role === "risk_analyst_agent" ||
    actor.role === "admin"
  ) {
    return true;
  }
  return false;
}

export function assertSellerPayerCnpjDiffer(sellerCnpj: string, payerCnpj: string): void {
  if (normalizeCnpj(sellerCnpj) === normalizeCnpj(payerCnpj)) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.SELLER_PAYER_MUST_DIFFER);
  }
}
