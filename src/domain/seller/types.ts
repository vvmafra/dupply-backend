export const SELLER_STATUSES = ["created", "in_review", "active", "inactive"] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

export type CompanyMetaData = {
  legalName: string;
  cnpj: string;
  foundingDate: string;
  shareCapital: number;
  annualRevenue: number;
  corporateEmail: string;
  phone: string;
  businessDescription: string;
  address: {
    zipCode: string;
    state: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
  };
};

export type LegalRepresentativeMetaData = {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  role: string;
};

export type BusinessRelation = {
  legalName: string;
  cnpj: string;
  sharePercentage?: number;
};

export type BusinessRelationsMetaData = {
  clients: BusinessRelation[];
  suppliers: BusinessRelation[];
};

export type SellerPublicView = {
  id: string;
  status: SellerStatus;
  name: string;
  companyMetaData: CompanyMetaData;
  legalRepresentativeMetaData: LegalRepresentativeMetaData;
  businessRelationsMetaData: BusinessRelationsMetaData;
  accountId: string;
  walletId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const EMPTY_COMPANY_METADATA = JSON.stringify({});
export const EMPTY_LEGAL_REP_METADATA = JSON.stringify({});
export const EMPTY_BUSINESS_RELATIONS_METADATA = JSON.stringify({ clients: [], suppliers: [] });
