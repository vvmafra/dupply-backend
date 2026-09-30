/**
 * Demo fixtures for `npm run seed:dev`. Pure data — no DB access here.
 *
 * Money in reais (the runner converts to cents), rates as fractions (0.018 = 1.8% a.m.),
 * dates relative to "now" in days so the demo always looks fresh.
 */
import type { ReceivableMetaData } from "../../src/modules/receivable/domain/types.js";
import type { ReceivableStatus } from "../../src/modules/receivable/domain/transitions.js";
import type {
  BusinessRelationsMetaData,
  CompanyMetaData,
  LegalRepresentativeMetaData,
  SellerStatus,
} from "../../src/modules/seller/domain/types.js";

export const DEMO_PASSWORD = "dev-password-change-me";

export type DemoSellerFixture = {
  key: "seller" | "sellerInReview";
  email: string;
  name: string;
  status: SellerStatus;
  company: CompanyMetaData;
  legalRepresentative: LegalRepresentativeMetaData;
  businessRelations: BusinessRelationsMetaData;
};

export const DEMO_SELLERS: DemoSellerFixture[] = [
  {
    key: "seller",
    email: "seller@dupply.dev.local",
    name: "Nova Era Distribuidora",
    status: "active",
    company: {
      legalName: "Nova Era Distribuidora de Alimentos LTDA",
      cnpj: "45678912000133",
      foundingDate: "2015-03-10",
      shareCapital: 850000,
      annualRevenue: 18500000,
      corporateEmail: "financeiro@novaera.com.br",
      phone: "11987654321",
      businessDescription:
        "Distribuição de alimentos secos e bebidas para varejo e food service no estado de São Paulo.",
      address: {
        zipCode: "04547130",
        state: "SP",
        street: "Rua Gomes de Carvalho",
        number: "1306",
        complement: "Conj. 82",
        neighborhood: "Vila Olímpia",
        city: "São Paulo",
      },
    },
    legalRepresentative: {
      fullName: "Mariana Costa Ribeiro",
      cpf: "32165498700",
      email: "mariana@novaera.com.br",
      phone: "11987654321",
      role: "Sócia Administradora",
    },
    businessRelations: {
      clients: [
        { legalName: "Payer Alpha S.A.", cnpj: "12345678000199", sharePercentage: 35 },
        { legalName: "Payer Beta S.A.", cnpj: "98765432000188", sharePercentage: 25 },
        { legalName: "Gama Indústria de Bebidas LTDA", cnpj: "11222333000181", sharePercentage: 15 },
      ],
      suppliers: [
        { legalName: "Moinho Sul Alimentos S.A.", cnpj: "22333444000155", sharePercentage: 40 },
        { legalName: "Cooperativa Agro Vale", cnpj: "33444555000166", sharePercentage: 30 },
      ],
    },
  },
  {
    key: "sellerInReview",
    email: "seller.review@dupply.dev.local",
    name: "Horizonte Têxtil",
    status: "in_review",
    company: {
      legalName: "Horizonte Têxtil Indústria e Comércio LTDA",
      cnpj: "78912345000122",
      foundingDate: "2019-08-22",
      shareCapital: 300000,
      annualRevenue: 6200000,
      corporateEmail: "contato@horizontetextil.com.br",
      phone: "47988776655",
      businessDescription: "Confecção de uniformes profissionais e malharia para atacado.",
      address: {
        zipCode: "89010000",
        state: "SC",
        street: "Rua XV de Novembro",
        number: "550",
        neighborhood: "Centro",
        city: "Blumenau",
      },
    },
    legalRepresentative: {
      fullName: "Carlos Eduardo Schmidt",
      cpf: "65498732100",
      email: "carlos@horizontetextil.com.br",
      phone: "47988776655",
      role: "Diretor",
    },
    businessRelations: {
      clients: [{ legalName: "Rede Uniformes Brasil S.A.", cnpj: "55666777000188", sharePercentage: 50 }],
      suppliers: [{ legalName: "Fiação Norte LTDA", cnpj: "66777888000199", sharePercentage: 60 }],
    },
  },
];

export const DEMO_INVESTOR = {
  email: "investor@dupply.dev.local",
  name: "Dev Investor",
  /** Available balance after the seeded investments (reais). */
  balanceReais: 1_000_000,
};

export const DEMO_STAFF = [
  { email: "analyst@dupply.dev.local", role: "risk_analyst" as const },
  { email: "admin@dupply.dev.local", role: "admin" as const },
];

export type DemoPayerFixture = { legalName: string; email: string; cnpj: string };

export const DEMO_PAYERS: DemoPayerFixture[] = [
  { legalName: "Payer Alpha S.A.", email: "financial@alpha.com", cnpj: "12345678000199" },
  { legalName: "Payer Beta S.A.", email: "financial@beta.com", cnpj: "98765432000188" },
  { legalName: "Gama Indústria de Bebidas LTDA", email: "fin@gama.com.br", cnpj: "11222333000181" },
];

export type DemoInvestmentFixture = {
  amountReais: number;
  status: "active" | "settled";
};

export type DemoReceivableFixture = {
  /** Stable label used in the seed summary. */
  key: string;
  /** Final status; the status timeline is derived from it. */
  status: ReceivableStatus;
  payerCnpj: string;
  valueReais: number;
  /** Set from `offer` onwards. */
  proposedValueReais?: number;
  yieldRateMonthly?: number;
  minInvestmentReais?: number;
  /** Days since the seller created the draft. Drives `createdAt` and the status timeline. */
  ageDays: number;
  /** Days until (positive) or since (negative) the bill's due date. */
  dueInDays: number;
  /** Investment by the demo investor, when the receivable reached funding. */
  investment?: DemoInvestmentFixture;
  withAiReport: boolean;
  meta: Pick<ReceivableMetaData, "type" | "billNumber" | "invoiceNumber" | "fiscalDocumentType" | "proofType">;
};

/** Ordered lifecycle used to derive `statusHistory` for each final status. */
export const STATUS_TIMELINES: Record<ReceivableStatus, ReceivableStatus[]> = {
  created: ["created"],
  under_review: ["created", "under_review"],
  reproved: ["created", "under_review", "reproved"],
  offer: ["created", "under_review", "offer"],
  rejected: ["created", "under_review", "offer", "rejected"],
  confirmed: ["created", "under_review", "offer", "confirmed"],
  funding: ["created", "under_review", "offer", "confirmed", "funding"],
  funded: ["created", "under_review", "offer", "confirmed", "funding", "funded"],
  processing: ["created", "under_review", "offer", "confirmed", "funding", "funded", "processing"],
  completed: [
    "created", "under_review", "offer", "confirmed", "funding", "funded", "processing", "completed",
  ],
  payer_settled: [
    "created", "under_review", "offer", "confirmed", "funding", "funded", "processing", "completed",
    "payer_settled",
  ],
  overdue: [
    "created", "under_review", "offer", "confirmed", "funding", "funded", "processing", "completed",
    "overdue",
  ],
};

const ALPHA = "12345678000199";
const BETA = "98765432000188";
const GAMA = "11222333000181";

/** One receivable per demo stage, all owned by the active demo seller. */
export const DEMO_RECEIVABLES: DemoReceivableFixture[] = [
  {
    key: "draft",
    status: "created",
    payerCnpj: GAMA,
    valueReais: 32_000,
    ageDays: 0,
    dueInDays: 60,
    withAiReport: false,
    meta: { type: "commercial", billNumber: "DUP-2026-0110", invoiceNumber: "NF-88210", fiscalDocumentType: "nfe", proofType: "delivery" },
  },
  {
    key: "under_review",
    status: "under_review",
    payerCnpj: ALPHA,
    valueReais: 85_000,
    ageDays: 1,
    dueInDays: 75,
    withAiReport: true,
    meta: { type: "commercial", billNumber: "DUP-2026-0109", invoiceNumber: "NF-88174", fiscalDocumentType: "nfe", proofType: "delivery" },
  },
  {
    key: "offer",
    status: "offer",
    payerCnpj: BETA,
    valueReais: 120_000,
    proposedValueReais: 114_000,
    yieldRateMonthly: 0.018,
    minInvestmentReais: 1_000,
    ageDays: 3,
    dueInDays: 90,
    withAiReport: true,
    meta: { type: "service", billNumber: "DUP-2026-0108", invoiceNumber: "NFS-4471", fiscalDocumentType: "nfse", proofType: "service_provision" },
  },
  {
    key: "confirmed",
    status: "confirmed",
    payerCnpj: ALPHA,
    valueReais: 60_000,
    proposedValueReais: 57_000,
    yieldRateMonthly: 0.017,
    minInvestmentReais: 1_000,
    ageDays: 4,
    dueInDays: 45,
    withAiReport: true,
    meta: { type: "commercial", billNumber: "DUP-2026-0107", invoiceNumber: "NF-88102", fiscalDocumentType: "nfe", proofType: "acceptance" },
  },
  {
    key: "funding",
    status: "funding",
    payerCnpj: ALPHA,
    valueReais: 250_000,
    proposedValueReais: 237_500,
    yieldRateMonthly: 0.015,
    minInvestmentReais: 1_000,
    ageDays: 6,
    dueInDays: 80,
    investment: { amountReais: 50_000, status: "active" },
    withAiReport: true,
    meta: { type: "commercial", billNumber: "DUP-2026-0106", invoiceNumber: "NF-87990", fiscalDocumentType: "nfe", proofType: "delivery" },
  },
  {
    key: "funded",
    status: "funded",
    payerCnpj: BETA,
    valueReais: 100_000,
    proposedValueReais: 95_000,
    yieldRateMonthly: 0.02,
    minInvestmentReais: 5_000,
    ageDays: 8,
    dueInDays: 70,
    investment: { amountReais: 95_000, status: "active" },
    withAiReport: true,
    meta: { type: "commercial", billNumber: "DUP-2026-0105", invoiceNumber: "NF-87811", fiscalDocumentType: "nfe", proofType: "delivery" },
  },
  {
    key: "processing",
    status: "processing",
    payerCnpj: GAMA,
    valueReais: 45_000,
    proposedValueReais: 42_750,
    yieldRateMonthly: 0.018,
    minInvestmentReais: 1_000,
    ageDays: 10,
    dueInDays: 55,
    investment: { amountReais: 42_750, status: "active" },
    withAiReport: true,
    meta: { type: "service", billNumber: "DUP-2026-0104", invoiceNumber: "NFS-4402", fiscalDocumentType: "nfse", proofType: "service_provision" },
  },
  {
    key: "completed",
    status: "completed",
    payerCnpj: ALPHA,
    valueReais: 80_000,
    proposedValueReais: 76_000,
    yieldRateMonthly: 0.018,
    minInvestmentReais: 1_000,
    ageDays: 30,
    dueInDays: 2,
    investment: { amountReais: 76_000, status: "active" },
    withAiReport: true,
    meta: { type: "commercial", billNumber: "DUP-2026-0103", invoiceNumber: "NF-87520", fiscalDocumentType: "nfe", proofType: "delivery" },
  },
  {
    key: "payer_settled",
    status: "payer_settled",
    payerCnpj: BETA,
    valueReais: 40_000,
    proposedValueReais: 38_000,
    yieldRateMonthly: 0.018,
    minInvestmentReais: 1_000,
    ageDays: 60,
    dueInDays: -12,
    investment: { amountReais: 38_000, status: "settled" },
    withAiReport: true,
    meta: { type: "commercial", billNumber: "DUP-2026-0102", invoiceNumber: "NF-87105", fiscalDocumentType: "nfe", proofType: "acceptance" },
  },
  {
    key: "overdue",
    status: "overdue",
    payerCnpj: GAMA,
    valueReais: 30_000,
    proposedValueReais: 28_500,
    yieldRateMonthly: 0.02,
    minInvestmentReais: 1_000,
    ageDays: 50,
    dueInDays: -5,
    investment: { amountReais: 28_500, status: "active" },
    withAiReport: true,
    meta: { type: "service", billNumber: "DUP-2026-0101", invoiceNumber: "NFS-4350", fiscalDocumentType: "nfse", proofType: "service_provision" },
  },
  {
    key: "reproved",
    status: "reproved",
    payerCnpj: GAMA,
    valueReais: 15_000,
    ageDays: 12,
    dueInDays: 20,
    withAiReport: true,
    meta: { type: "commercial", billNumber: "DUP-2026-0100", invoiceNumber: "NF-87001", fiscalDocumentType: "nfe", proofType: "delivery" },
  },
];

/**
 * AI credit report as rendered by the analyst screen (`DuplicataAiReport` in the frontend).
 * Numbers in reais.
 */
export function buildDemoAiReport(company: CompanyMetaData, payer: DemoPayerFixture) {
  return {
    companyDescription:
      `${company.legalName} atua em ${company.businessDescription.toLowerCase()} ` +
      `Fundada em ${company.foundingDate.slice(0, 4)}, com faturamento anual declarado de ` +
      `R$ ${company.annualRevenue.toLocaleString("pt-BR")} e capital social de ` +
      `R$ ${company.shareCapital.toLocaleString("pt-BR")}. Relacionamento comercial recorrente com ` +
      `${payer.legalName}, sacado desta duplicata, há mais de 24 meses.`,
    foundationYear: Number(company.foundingDate.slice(0, 4)),
    shareholders: [
      { name: "Mariana Costa Ribeiro", percentage: 60, role: "Sócia Administradora" },
      { name: "Ricardo Alves Ribeiro", percentage: 40, role: "Sócio" },
    ],
    customerPortfolio: [
      { name: "Payer Alpha S.A.", cnpj: "12345678000199", percentage: 35 },
      { name: "Payer Beta S.A.", cnpj: "98765432000188", percentage: 25 },
      { name: "Gama Indústria de Bebidas LTDA", cnpj: "11222333000181", percentage: 15 },
      { name: "Outros", cnpj: null, percentage: 25 },
    ],
    suppliers: [
      { name: "Moinho Sul Alimentos S.A.", cnpj: "22333444000155", percentage: 40 },
      { name: "Cooperativa Agro Vale", cnpj: "33444555000166", percentage: 30 },
      { name: "Outros", cnpj: null, percentage: 30 },
    ],
    swot: {
      strengths: [
        "Carteira de clientes concentrada em grandes redes com histórico de pagamento pontual",
        "Margem bruta estável nos últimos 3 exercícios",
        "Sacado com aceite formal da duplicata",
      ],
      weaknesses: [
        "Dependência de três clientes para 75% da receita",
        "Endividamento bancário de curto prazo acima da média do setor",
      ],
      opportunities: [
        "Expansão para o interior de SP com novo centro de distribuição",
        "Antecipação de recebíveis reduz custo financeiro frente ao capital de giro bancário",
      ],
      threats: [
        "Pressão de preço de fornecedores de commodities",
        "Sazonalidade no segundo trimestre",
      ],
    },
    financialAnalysis:
      "Liquidez corrente de 1,4x e cobertura de juros confortável. O título tem lastro em nota " +
      "fiscal eletrônica com comprovante de entrega e aceite do sacado. Risco de crédito do " +
      "sacado classificado como baixo; risco de performance do cedente classificado como médio " +
      "pela concentração de clientes. Recomendação: aprovar com deságio entre 4% e 6%.",
    financialMetrics: {
      netRevenue: company.annualRevenue,
      netResult: Math.round(company.annualRevenue * 0.06),
      totalAssets: Math.round(company.annualRevenue * 0.55),
      totalLiabilities: Math.round(company.annualRevenue * 0.32),
      equity: Math.round(company.annualRevenue * 0.23),
      bankDebt: Math.round(company.annualRevenue * 0.11),
    },
  };
}
