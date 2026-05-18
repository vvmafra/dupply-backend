#![cfg(test)]

use crate::types::{
    DuplicataAceiteSacado, DuplicataComprovanteTipo, DuplicataFiscalTipo, DuplicataTipo,
    IssuePayload,
};
use crate::{DuplicataRegistry, DuplicataRegistryClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, Env};

fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

fn sample_payload(env: &Env) -> IssuePayload {
    IssuePayload {
        tipo: DuplicataTipo::Mercantil,
        numero_duplicata_hash: zero_hash(env),
        numero_fatura_hash: zero_hash(env),
        doc_fiscal_chave_hash: zero_hash(env),
        sacado_commitment: zero_hash(env),
        doc_fiscal_tipo: DuplicataFiscalTipo::Nfe,
        comprovante_tipo: DuplicataComprovanteTipo::Entrega,
        status_aceite_sacado: DuplicataAceiteSacado::Pendente,
        valor_face_centavos: 1_000_000,
        valor_max_antecipacao_centavos: 500_000,
        data_emissao_unix: 1_700_000_000,
        data_vencimento_unix: 1_800_000_000,
        doc_fiscal_anexado: true,
        comprovante_anexado: true,
        declaracoes_antifraude_aceitas: true,
        discount_eligible: true,
    }
}

#[test]
fn initialize_set_admin_allowlist_and_issue() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(DuplicataRegistry, ());
    let client = DuplicataRegistryClient::new(&env, &contract_id);

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

    let dup = client.get_duplicata(&1).expect("duplicata");
    assert_eq!(dup.id, 1);
    assert_eq!(dup.issuer, issuer);
    assert_eq!(dup.valor_face_centavos, 1_000_000);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #4)")]
fn issue_fails_if_not_allowlisted() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(DuplicataRegistry, ());
    let client = DuplicataRegistryClient::new(&env, &contract_id);
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
    let contract_id = env.register(DuplicataRegistry, ());
    let client = DuplicataRegistryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    client.initialize(&admin);
    client.set_issuer_allowed(&issuer, &true);
    let mut p = sample_payload(&env);
    p.declaracoes_antifraude_aceitas = false;
    let _ = client.issue(&issuer, &p);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #9)")]
fn discount_eligible_requires_attachments() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(DuplicataRegistry, ());
    let client = DuplicataRegistryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    client.initialize(&admin);
    client.set_issuer_allowed(&issuer, &true);
    let mut p = sample_payload(&env);
    p.discount_eligible = true;
    p.doc_fiscal_anexado = false;
    let _ = client.issue(&issuer, &p);
}
