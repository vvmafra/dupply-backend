#![cfg(test)]

use crate::types::{
    BillKind, BillStatus, DraweeAcceptance, EvidenceKind, FiscalDocKind, IssuePayload,
};
use crate::{TradeBillRegistry, TradeBillRegistryClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, Env};

fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

fn sample_payload(env: &Env) -> IssuePayload {
    IssuePayload {
        kind: BillKind::Commercial,
        draft_number_hash: zero_hash(env),
        invoice_number_hash: zero_hash(env),
        fiscal_doc_key_hash: zero_hash(env),
        drawee_commitment: zero_hash(env),
        fiscal_doc_kind: FiscalDocKind::Nfe,
        evidence_kind: EvidenceKind::Delivery,
        drawee_acceptance: DraweeAcceptance::Pending,
        face_value_cents: 1_000_000,
        max_advance_value_cents: 500_000,
        issue_date_unix: 1_700_000_000,
        due_date_unix: 1_800_000_000,
        fiscal_doc_attached: true,
        evidence_attached: true,
        fraud_declarations_accepted: true,
        discount_eligible: true,
    }
}

#[test]
fn initialize_set_admin_allowlist_and_issue() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.initialize(&admin);
    assert_eq!(client.admin(), Some(admin.clone()));
    assert_eq!(client.next_id(), 1);

    client.set_issuer_allowed(&issuer, &true);
    assert!(client.is_issuer_allowed(&issuer));

    let id = client.issue(&issuer, &sample_payload(&env));
    assert_eq!(id, 1);
    assert_eq!(client.next_id(), 2);

    let bill = client.get_trade_bill(&1).expect("trade bill");
    assert_eq!(bill.id, 1);
    assert_eq!(bill.issuer, issuer);
    assert_eq!(bill.face_value_cents, 1_000_000);
    assert_eq!(bill.status, BillStatus::Issued);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #4)")]
fn issue_fails_if_not_allowlisted() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    client.initialize(&admin);
    let _ = client.issue(&issuer, &sample_payload(&env));
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #7)")]
fn issue_fails_without_fraud_declaration() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    client.initialize(&admin);
    client.set_issuer_allowed(&issuer, &true);
    let mut p = sample_payload(&env);
    p.fraud_declarations_accepted = false;
    let _ = client.issue(&issuer, &p);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #9)")]
fn discount_eligible_requires_attachments() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    client.initialize(&admin);
    client.set_issuer_allowed(&issuer, &true);
    let mut p = sample_payload(&env);
    p.discount_eligible = true;
    p.fiscal_doc_attached = false;
    let _ = client.issue(&issuer, &p);
}

#[test]
fn update_bill_status_success_by_admin_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.initialize(&admin);
    client.set_issuer_allowed(&issuer, &true);

    let id = client.issue(&issuer, &sample_payload(&env));

    // Admin transitions: Issued -> Funding -> Funded -> Overdue -> Settled -> PaidOut
    client.update_bill_status(&admin, &id, &BillStatus::Funding);
    assert_eq!(client.get_trade_bill(&id).unwrap().status, BillStatus::Funding);

    client.update_bill_status(&admin, &id, &BillStatus::Funded);
    assert_eq!(client.get_trade_bill(&id).unwrap().status, BillStatus::Funded);

    client.update_bill_status(&admin, &id, &BillStatus::Overdue);
    assert_eq!(client.get_trade_bill(&id).unwrap().status, BillStatus::Overdue);

    client.update_bill_status(&admin, &id, &BillStatus::Settled);
    assert_eq!(client.get_trade_bill(&id).unwrap().status, BillStatus::Settled);

    client.update_bill_status(&admin, &id, &BillStatus::PaidOut);
    assert_eq!(client.get_trade_bill(&id).unwrap().status, BillStatus::PaidOut);
}

#[test]
fn update_bill_status_success_by_issuer_cancelled() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.initialize(&admin);
    client.set_issuer_allowed(&issuer, &true);

    let id = client.issue(&issuer, &sample_payload(&env));

    // Issuer transitions: Issued -> Cancelled
    client.update_bill_status(&issuer, &id, &BillStatus::Cancelled);
    assert_eq!(client.get_trade_bill(&id).unwrap().status, BillStatus::Cancelled);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #3)")]
fn update_bill_status_fails_if_unauthorized_issuer_funding() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.initialize(&admin);
    client.set_issuer_allowed(&issuer, &true);

    let id = client.issue(&issuer, &sample_payload(&env));

    // Issuer cannot transition to Funding (unauthorized)
    client.update_bill_status(&issuer, &id, &BillStatus::Funding);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #3)")]
fn update_bill_status_fails_if_unauthorized_third_party() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let random_user = Address::generate(&env);

    client.initialize(&admin);
    client.set_issuer_allowed(&issuer, &true);

    let id = client.issue(&issuer, &sample_payload(&env));

    // Random user cannot transition to Cancelled (unauthorized)
    client.update_bill_status(&random_user, &id, &BillStatus::Cancelled);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #8)")]
fn update_bill_status_fails_for_non_existent_bill() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Non-existent bill ID 999
    client.update_bill_status(&admin, &999, &BillStatus::Funding);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #10)")]
fn update_bill_status_fails_for_invalid_transition() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TradeBillRegistry, ());
    let client = TradeBillRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.initialize(&admin);
    client.set_issuer_allowed(&issuer, &true);

    let id = client.issue(&issuer, &sample_payload(&env));

    // Invalid transition: Issued -> Settled (skips Funding & Funded)
    client.update_bill_status(&admin, &id, &BillStatus::Settled);
}
