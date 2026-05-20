#![no_std]
mod error;
mod types;

use error::RegistryError;
use soroban_sdk::{
    contract, contractevent, contractimpl, panic_with_error, Address, Env, Symbol, symbol_short,
};
use types::{DataKey, IssuePayload, TradeBill};

const KEY_ADMIN: Symbol = symbol_short!("ADMIN");
const KEY_NEXT: Symbol = symbol_short!("NEXT_ID");

fn bump_instance(env: &Env) {
    let max = env.storage().max_ttl();
    env.storage().instance().extend_ttl(1, max);
}

fn bump_persistent<K>(env: &Env, key: &K)
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val>
        + soroban_sdk::TryFromVal<Env, soroban_sdk::Val>
        + Clone,
{
    let max = env.storage().max_ttl();
    env.storage().persistent().extend_ttl(key, 1, max);
}

fn require_initialized(env: &Env) -> Address {
    if !env.storage().instance().has(&KEY_ADMIN) {
        panic_with_error!(env, RegistryError::NotInitialized);
    }
    env.storage()
        .instance()
        .get(&KEY_ADMIN)
        .expect("admin")
}

#[contractevent]
pub struct TradeBillIssued {
    #[topic]
    pub id: u64,
    #[topic]
    pub issuer: Address,
    pub face_value_cents: i128,
    pub max_advance_value_cents: i128,
    pub due_date_unix: u64,
    pub discount_eligible: bool,
    pub issued_at: u64,
}

fn validate_payload(env: &Env, p: &IssuePayload) {
    if !p.fraud_declarations_accepted {
        panic_with_error!(env, RegistryError::FraudDeclarationsRequired);
    }
    if p.face_value_cents <= 0 {
        panic_with_error!(env, RegistryError::InvalidAmounts);
    }
    if p.max_advance_value_cents < 0 || p.max_advance_value_cents > p.face_value_cents {
        panic_with_error!(env, RegistryError::InvalidAmounts);
    }
    if p.due_date_unix <= p.issue_date_unix {
        panic_with_error!(env, RegistryError::InvalidDates);
    }
    if p.discount_eligible && (!p.fiscal_doc_attached || !p.evidence_attached) {
        panic_with_error!(env, RegistryError::InvalidDiscountFlags);
    }
}

#[contract]
pub struct TradeBillRegistry;

#[contractimpl]
impl TradeBillRegistry {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&KEY_ADMIN) {
            panic_with_error!(&env, RegistryError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&KEY_ADMIN, &admin);
        env.storage().instance().set(&KEY_NEXT, &1_u64);
        bump_instance(&env);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let current = require_initialized(&env);
        current.require_auth();
        env.storage().instance().set(&KEY_ADMIN, &new_admin);
        bump_instance(&env);
    }

    pub fn set_issuer_allowed(env: Env, issuer: Address, allowed: bool) {
        let admin = require_initialized(&env);
        admin.require_auth();
        let key = DataKey::Iss(issuer.clone());
        if allowed {
            env.storage().persistent().set(&key, &true);
            bump_persistent(&env, &key);
        } else if env.storage().persistent().has(&key) {
            env.storage().persistent().remove(&key);
        }
        bump_instance(&env);
    }

    pub fn admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&KEY_ADMIN)
    }

    pub fn next_id(env: Env) -> u64 {
        env.storage().instance().get(&KEY_NEXT).unwrap_or(1)
    }

    pub fn is_issuer_allowed(env: Env, issuer: Address) -> bool {
        let key = DataKey::Iss(issuer);
        env.storage()
            .persistent()
            .get::<DataKey, bool>(&key)
            .unwrap_or(false)
    }

    pub fn get_trade_bill(env: Env, id: u64) -> Option<TradeBill> {
        let key = DataKey::Rec(id);
        env.storage().persistent().get(&key)
    }

    pub fn issue(env: Env, issuer: Address, payload: IssuePayload) -> u64 {
        require_initialized(&env);
        issuer.require_auth();
        if !Self::is_issuer_allowed(env.clone(), issuer.clone()) {
            panic_with_error!(&env, RegistryError::IssuerNotAllowed);
        }
        validate_payload(&env, &payload);

        let id: u64 = env
            .storage()
            .instance()
            .get(&KEY_NEXT)
            .expect("next id");
        let issued_at = env.ledger().timestamp();

        let bill = TradeBill {
            id,
            issuer: issuer.clone(),
            issued_at,
            kind: payload.kind.clone(),
            draft_number_hash: payload.draft_number_hash.clone(),
            invoice_number_hash: payload.invoice_number_hash.clone(),
            fiscal_doc_key_hash: payload.fiscal_doc_key_hash.clone(),
            drawee_commitment: payload.drawee_commitment.clone(),
            fiscal_doc_kind: payload.fiscal_doc_kind.clone(),
            evidence_kind: payload.evidence_kind.clone(),
            drawee_acceptance: payload.drawee_acceptance.clone(),
            face_value_cents: payload.face_value_cents,
            max_advance_value_cents: payload.max_advance_value_cents,
            issue_date_unix: payload.issue_date_unix,
            due_date_unix: payload.due_date_unix,
            fiscal_doc_attached: payload.fiscal_doc_attached,
            evidence_attached: payload.evidence_attached,
            fraud_declarations_accepted: payload.fraud_declarations_accepted,
            discount_eligible: payload.discount_eligible,
        };

        let bill_key = DataKey::Rec(id);
        env.storage().persistent().set(&bill_key, &bill);
        bump_persistent(&env, &bill_key);

        let next = id.checked_add(1).expect("overflow");
        env.storage().instance().set(&KEY_NEXT, &next);
        bump_instance(&env);

        TradeBillIssued {
            id,
            issuer: issuer.clone(),
            face_value_cents: bill.face_value_cents,
            max_advance_value_cents: bill.max_advance_value_cents,
            due_date_unix: bill.due_date_unix,
            discount_eligible: bill.discount_eligible,
            issued_at: bill.issued_at,
        }
        .publish(&env);

        id
    }
}

mod test;
