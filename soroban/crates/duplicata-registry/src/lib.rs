#![no_std]
mod error;
mod types;

use error::RegistryError;
use soroban_sdk::{
    contract, contractevent, contractimpl, panic_with_error, Address, Env, Symbol, symbol_short,
};
use types::{DataKey, Duplicata, IssuePayload};

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
pub struct DuplicataIssued {
    #[topic]
    pub id: u64,
    #[topic]
    pub issuer: Address,
    pub valor_face_centavos: i128,
    pub valor_max_antecipacao_centavos: i128,
    pub data_vencimento_unix: u64,
    pub discount_eligible: bool,
    pub issued_at: u64,
}

fn validate_payload(env: &Env, p: &IssuePayload) {
    if !p.declaracoes_antifraude_aceitas {
        panic_with_error!(env, RegistryError::FraudDeclarationsRequired);
    }
    if p.valor_face_centavos <= 0 {
        panic_with_error!(env, RegistryError::InvalidAmounts);
    }
    if p.valor_max_antecipacao_centavos < 0 || p.valor_max_antecipacao_centavos > p.valor_face_centavos {
        panic_with_error!(env, RegistryError::InvalidAmounts);
    }
    if p.data_vencimento_unix <= p.data_emissao_unix {
        panic_with_error!(env, RegistryError::InvalidDates);
    }
    if p.discount_eligible && (!p.doc_fiscal_anexado || !p.comprovante_anexado) {
        panic_with_error!(env, RegistryError::InvalidDiscountFlags);
    }
}

#[contract]
pub struct DuplicataRegistry;

#[contractimpl]
impl DuplicataRegistry {
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

    pub fn get_duplicata(env: Env, id: u64) -> Option<Duplicata> {
        let key = DataKey::Dup(id);
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

        let dup = Duplicata {
            id,
            issuer: issuer.clone(),
            issued_at,
            tipo: payload.tipo.clone(),
            numero_duplicata_hash: payload.numero_duplicata_hash.clone(),
            numero_fatura_hash: payload.numero_fatura_hash.clone(),
            doc_fiscal_chave_hash: payload.doc_fiscal_chave_hash.clone(),
            sacado_commitment: payload.sacado_commitment.clone(),
            doc_fiscal_tipo: payload.doc_fiscal_tipo.clone(),
            comprovante_tipo: payload.comprovante_tipo.clone(),
            status_aceite_sacado: payload.status_aceite_sacado.clone(),
            valor_face_centavos: payload.valor_face_centavos,
            valor_max_antecipacao_centavos: payload.valor_max_antecipacao_centavos,
            data_emissao_unix: payload.data_emissao_unix,
            data_vencimento_unix: payload.data_vencimento_unix,
            doc_fiscal_anexado: payload.doc_fiscal_anexado,
            comprovante_anexado: payload.comprovante_anexado,
            declaracoes_antifraude_aceitas: payload.declaracoes_antifraude_aceitas,
            discount_eligible: payload.discount_eligible,
        };

        let dup_key = DataKey::Dup(id);
        env.storage().persistent().set(&dup_key, &dup);
        bump_persistent(&env, &dup_key);

        let next = id.checked_add(1).expect("overflow");
        env.storage().instance().set(&KEY_NEXT, &next);
        bump_instance(&env);

        DuplicataIssued {
            id,
            issuer: issuer.clone(),
            valor_face_centavos: dup.valor_face_centavos,
            valor_max_antecipacao_centavos: dup.valor_max_antecipacao_centavos,
            data_vencimento_unix: dup.data_vencimento_unix,
            discount_eligible: dup.discount_eligible,
            issued_at: dup.issued_at,
        }
        .publish(&env);

        id
    }
}

mod test;
