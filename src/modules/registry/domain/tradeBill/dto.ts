import { z } from "zod";

const hash32 = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters (32 bytes)");

export const createTradeBillBodySchema = z.object({
  issuerPublicKey: z.string().min(1),
  billKind: z.enum(["commercial", "service"]),
  draftNumberHash: hash32,
  invoiceNumberHash: hash32,
  fiscalDocKeyHash: hash32,
  draweeCommitment: hash32,
  fiscalDocKind: z.enum(["nfe", "nfce", "nfse", "other"]),
  evidenceKind: z.enum(["delivery", "acceptance", "service_performed"]),
  draweeAcceptance: z.enum(["accepted", "pending", "rejected"]),
  faceValueCents: z.string().regex(/^-?\d+$/),
  maxAdvanceValueCents: z.string().regex(/^-?\d+$/),
  issueDateUnix: z.number().int().nonnegative(),
  dueDateUnix: z.number().int().nonnegative(),
  fiscalDocAttached: z.boolean(),
  evidenceAttached: z.boolean(),
  fraudDeclarationsAccepted: z.boolean(),
  discountEligible: z.boolean(),
});

export type CreateTradeBillBody = z.infer<typeof createTradeBillBodySchema>;

export const confirmTradeBillBodySchema = z.object({
  txHash: z.string().min(1),
});

export type ConfirmTradeBillBody = z.infer<typeof confirmTradeBillBodySchema>;

export function validateIssueInvariants(body: CreateTradeBillBody): void {
  if (!body.fraudDeclarationsAccepted) {
    throw new DomainError(
      "FraudDeclarationsRequired",
      "fraud_declarations_accepted must be true",
    );
  }
  const face = BigInt(body.faceValueCents);
  const maxAdv = BigInt(body.maxAdvanceValueCents);
  if (face <= 0n) {
    throw new DomainError("InvalidAmounts", "face_value_cents must be > 0");
  }
  if (maxAdv < 0n || maxAdv > face) {
    throw new DomainError("InvalidAmounts", "max_advance_value_cents out of range");
  }
  if (body.dueDateUnix <= body.issueDateUnix) {
    throw new DomainError("InvalidDates", "due_date_unix must be > issue_date_unix");
  }
  if (body.discountEligible && (!body.fiscalDocAttached || !body.evidenceAttached)) {
    throw new DomainError(
      "InvalidDiscountFlags",
      "discount_eligible requires both attachment flags",
    );
  }
}

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
