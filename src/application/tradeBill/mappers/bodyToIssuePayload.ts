import { Buffer } from "buffer";

import type { CreateTradeBillBody } from "../../../domain/tradeBill/dto.js";
import {
  BillKind,
  DraweeAcceptance,
  EvidenceKind,
  FiscalDocKind,
  type IssuePayload,
} from "../../../generated/trade-bill-registry-contract.js";

function hashToBuffer(hex64: string): Buffer {
  return Buffer.from(hex64, "hex");
}

export function bodyToIssuePayload(body: CreateTradeBillBody): IssuePayload {
  const kind =
    body.billKind === "commercial" ? BillKind.Commercial : BillKind.Service;
  const fiscalDocKind = {
    nfe: FiscalDocKind.Nfe,
    nfce: FiscalDocKind.Nfce,
    nfse: FiscalDocKind.Nfse,
    other: FiscalDocKind.Other,
  }[body.fiscalDocKind];
  const evidenceKind = {
    delivery: EvidenceKind.Delivery,
    acceptance: EvidenceKind.Acceptance,
    service_performed: EvidenceKind.ServicePerformed,
  }[body.evidenceKind];
  const draweeAcceptance = {
    accepted: DraweeAcceptance.Accepted,
    pending: DraweeAcceptance.Pending,
    rejected: DraweeAcceptance.Rejected,
  }[body.draweeAcceptance];

  return {
    kind,
    draft_number_hash: hashToBuffer(body.draftNumberHash),
    invoice_number_hash: hashToBuffer(body.invoiceNumberHash),
    fiscal_doc_key_hash: hashToBuffer(body.fiscalDocKeyHash),
    drawee_commitment: hashToBuffer(body.draweeCommitment),
    fiscal_doc_kind: fiscalDocKind,
    evidence_kind: evidenceKind,
    drawee_acceptance: draweeAcceptance,
    face_value_cents: BigInt(body.faceValueCents),
    max_advance_value_cents: BigInt(body.maxAdvanceValueCents),
    issue_date_unix: BigInt(body.issueDateUnix),
    due_date_unix: BigInt(body.dueDateUnix),
    fiscal_doc_attached: body.fiscalDocAttached,
    evidence_attached: body.evidenceAttached,
    fraud_declarations_accepted: body.fraudDeclarationsAccepted,
    discount_eligible: body.discountEligible,
  };
}
