import { Buffer } from "buffer";

import {
  DuplicataAceiteSacado,
  DuplicataComprovanteTipo,
  DuplicataFiscalTipo,
  DuplicataTipo,
  type IssuePayload,
} from "../../generated/duplicata-registry-contract.js";

import type { CreateDuplicataBody } from "./dto.js";

function hashToBuffer(hex64: string): Buffer {
  return Buffer.from(hex64, "hex");
}

export function bodyToIssuePayload(body: CreateDuplicataBody): IssuePayload {
  const tipo =
    body.tipo === "mercantil" ? DuplicataTipo.Mercantil : DuplicataTipo.Servico;
  const docFiscalTipo = {
    nfe: DuplicataFiscalTipo.Nfe,
    nfce: DuplicataFiscalTipo.Nfce,
    nfse: DuplicataFiscalTipo.Nfse,
    outro: DuplicataFiscalTipo.Outro,
  }[body.docFiscalTipo];
  const comprovanteTipo = {
    entrega: DuplicataComprovanteTipo.Entrega,
    aceite: DuplicataComprovanteTipo.Aceite,
    prestacao_servico: DuplicataComprovanteTipo.PrestacaoServico,
  }[body.comprovanteTipo];
  const statusAceiteSacado = {
    aceito: DuplicataAceiteSacado.Aceito,
    pendente: DuplicataAceiteSacado.Pendente,
    recusado: DuplicataAceiteSacado.Recusado,
  }[body.statusAceiteSacado];

  return {
    tipo,
    numero_duplicata_hash: hashToBuffer(body.numeroDuplicataHash),
    numero_fatura_hash: hashToBuffer(body.numeroFaturaHash),
    doc_fiscal_chave_hash: hashToBuffer(body.docFiscalChaveHash),
    sacado_commitment: hashToBuffer(body.sacadoCommitment),
    doc_fiscal_tipo: docFiscalTipo,
    comprovante_tipo: comprovanteTipo,
    status_aceite_sacado: statusAceiteSacado,
    valor_face_centavos: BigInt(body.valorFaceCentavos),
    valor_max_antecipacao_centavos: BigInt(body.valorMaxAntecipacaoCentavos),
    data_emissao_unix: BigInt(body.dataEmissaoUnix),
    data_vencimento_unix: BigInt(body.dataVencimentoUnix),
    doc_fiscal_anexado: body.docFiscalAnexado,
    comprovante_anexado: body.comprovanteAnexado,
    declaracoes_antifraude_aceitas: body.declaracoesAntifraudeAceitas,
    discount_eligible: body.discountEligible,
  };
}
