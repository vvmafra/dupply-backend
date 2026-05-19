use soroban_sdk::{contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BillKind {
    Commercial = 0,
    Service = 1,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FiscalDocKind {
    Nfe = 0,
    Nfce = 1,
    Nfse = 2,
    Other = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EvidenceKind {
    Delivery = 0,
    Acceptance = 1,
    ServicePerformed = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DraweeAcceptance {
    Accepted = 0,
    Pending = 1,
    Rejected = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Iss(Address),
    Rec(u64),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuePayload {
    pub kind: BillKind,
    pub draft_number_hash: BytesN<32>,
    pub invoice_number_hash: BytesN<32>,
    pub fiscal_doc_key_hash: BytesN<32>,
    pub drawee_commitment: BytesN<32>,
    pub fiscal_doc_kind: FiscalDocKind,
    pub evidence_kind: EvidenceKind,
    pub drawee_acceptance: DraweeAcceptance,
    pub face_value_cents: i128,
    pub max_advance_value_cents: i128,
    pub issue_date_unix: u64,
    pub due_date_unix: u64,
    pub fiscal_doc_attached: bool,
    pub evidence_attached: bool,
    pub fraud_declarations_accepted: bool,
    pub discount_eligible: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TradeBill {
    pub id: u64,
    pub issuer: Address,
    pub issued_at: u64,
    pub kind: BillKind,
    pub draft_number_hash: BytesN<32>,
    pub invoice_number_hash: BytesN<32>,
    pub fiscal_doc_key_hash: BytesN<32>,
    pub drawee_commitment: BytesN<32>,
    pub fiscal_doc_kind: FiscalDocKind,
    pub evidence_kind: EvidenceKind,
    pub drawee_acceptance: DraweeAcceptance,
    pub face_value_cents: i128,
    pub max_advance_value_cents: i128,
    pub issue_date_unix: u64,
    pub due_date_unix: u64,
    pub fiscal_doc_attached: bool,
    pub evidence_attached: bool,
    pub fraud_declarations_accepted: bool,
    pub discount_eligible: bool,
}
