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
  receivable: { sellerId: string; status: string },
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
  // Investors are allowed to view receivables that are open for funding or in later lifecycle stages
  if (actor.role === "investor") {
    return [
      RECEIVABLE_STATUS.FUNDING,
      RECEIVABLE_STATUS.FUNDED,
      RECEIVABLE_STATUS.PROCESSING,
      RECEIVABLE_STATUS.COMPLETED,
      RECEIVABLE_STATUS.PAYER_SETTLED,
      RECEIVABLE_STATUS.OVERDUE,
    ].includes(receivable.status as any);
  }
  return false;
}

export function assertSellerPayerCnpjDiffer(sellerCnpj: string, payerCnpj: string): void {
  if (normalizeCnpj(sellerCnpj) === normalizeCnpj(payerCnpj)) {
    throw new ReceivableError(RECEIVABLE_ERROR_CODES.SELLER_PAYER_MUST_DIFFER);
  }
}
