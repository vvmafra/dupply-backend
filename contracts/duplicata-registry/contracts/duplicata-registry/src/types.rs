use soroban_sdk::{contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DuplicataTipo {
    Mercantil = 0,
    Servico = 1,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DuplicataFiscalTipo {
    Nfe = 0,
    Nfce = 1,
    Nfse = 2,
    Outro = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DuplicataComprovanteTipo {
    Entrega = 0,
    Aceite = 1,
    PrestacaoServico = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DuplicataAceiteSacado {
    Aceito = 0,
    Pendente = 1,
    Recusado = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Iss(Address),
    Dup(u64),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IssuePayload {
    pub tipo: DuplicataTipo,
    pub numero_duplicata_hash: BytesN<32>,
    pub numero_fatura_hash: BytesN<32>,
    pub doc_fiscal_chave_hash: BytesN<32>,
    pub sacado_commitment: BytesN<32>,
    pub doc_fiscal_tipo: DuplicataFiscalTipo,
    pub comprovante_tipo: DuplicataComprovanteTipo,
    pub status_aceite_sacado: DuplicataAceiteSacado,
    pub valor_face_centavos: i128,
    pub valor_max_antecipacao_centavos: i128,
    pub data_emissao_unix: u64,
    pub data_vencimento_unix: u64,
    pub doc_fiscal_anexado: bool,
    pub comprovante_anexado: bool,
    pub declaracoes_antifraude_aceitas: bool,
    pub discount_eligible: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Duplicata {
    pub id: u64,
    pub issuer: Address,
    pub issued_at: u64,
    pub tipo: DuplicataTipo,
    pub numero_duplicata_hash: BytesN<32>,
    pub numero_fatura_hash: BytesN<32>,
    pub doc_fiscal_chave_hash: BytesN<32>,
    pub sacado_commitment: BytesN<32>,
    pub doc_fiscal_tipo: DuplicataFiscalTipo,
    pub comprovante_tipo: DuplicataComprovanteTipo,
    pub status_aceite_sacado: DuplicataAceiteSacado,
    pub valor_face_centavos: i128,
    pub valor_max_antecipacao_centavos: i128,
    pub data_emissao_unix: u64,
    pub data_vencimento_unix: u64,
    pub doc_fiscal_anexado: bool,
    pub comprovante_anexado: bool,
    pub declaracoes_antifraude_aceitas: bool,
    pub discount_eligible: bool,
}
