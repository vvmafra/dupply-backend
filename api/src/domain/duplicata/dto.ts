import { z } from "zod";

const hash32 = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters (32 bytes)");

export const createDuplicataBodySchema = z.object({
  issuerPublicKey: z.string().min(1),
  tipo: z.enum(["mercantil", "servico"]),
  numeroDuplicataHash: hash32,
  numeroFaturaHash: hash32,
  docFiscalChaveHash: hash32,
  sacadoCommitment: hash32,
  docFiscalTipo: z.enum(["nfe", "nfce", "nfse", "outro"]),
  comprovanteTipo: z.enum(["entrega", "aceite", "prestacao_servico"]),
  statusAceiteSacado: z.enum(["aceito", "pendente", "recusado"]),
  valorFaceCentavos: z.string().regex(/^-?\d+$/),
  valorMaxAntecipacaoCentavos: z.string().regex(/^-?\d+$/),
  dataEmissaoUnix: z.number().int().nonnegative(),
  dataVencimentoUnix: z.number().int().nonnegative(),
  docFiscalAnexado: z.boolean(),
  comprovanteAnexado: z.boolean(),
  declaracoesAntifraudeAceitas: z.boolean(),
  discountEligible: z.boolean(),
});

export type CreateDuplicataBody = z.infer<typeof createDuplicataBodySchema>;

export const confirmDuplicataBodySchema = z.object({
  txHash: z.string().min(1),
});

export type ConfirmDuplicataBody = z.infer<typeof confirmDuplicataBodySchema>;

export function validateIssueInvariants(body: CreateDuplicataBody): void {
  if (!body.declaracoesAntifraudeAceitas) {
    throw new DomainError("FraudDeclarationsRequired", "declaracoes_antifraude_aceitas must be true");
  }
  const face = BigInt(body.valorFaceCentavos);
  const maxAnt = BigInt(body.valorMaxAntecipacaoCentavos);
  if (face <= 0n) {
    throw new DomainError("InvalidAmounts", "valor_face_centavos must be > 0");
  }
  if (maxAnt < 0n || maxAnt > face) {
    throw new DomainError("InvalidAmounts", "valor_max_antecipacao_centavos out of range");
  }
  if (body.dataVencimentoUnix <= body.dataEmissaoUnix) {
    throw new DomainError("InvalidDates", "data_vencimento_unix must be > data_emissao_unix");
  }
  if (body.discountEligible && (!body.docFiscalAnexado || !body.comprovanteAnexado)) {
    throw new DomainError("InvalidDiscountFlags", "discount_eligible requires both attachment flags");
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
