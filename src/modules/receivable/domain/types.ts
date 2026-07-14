export type ReceivableMetaData = {
  type: "commercial" | "service";
  billNumber: string;
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string;
  payerCnpj: string;
  payerLegalName: string;
  payerFinancialEmail: string;
  fiscalDocumentType: "nfe" | "nfce" | "nfse" | "other";
  fiscalDocumentKey: string;
  proofType: "delivery" | "acceptance" | "service_provision";
  payerAcceptanceStatus: "accepted" | "pending" | "refused";
  /** Stored JSON: centavos BRL; API I/O: reais — see money.mdc */
  desiredAnticipationValue: number;
  antifraudDeclarationsAccepted: boolean;
};

export type ReceivableRow = {
  id: string;
  status: string;
  sellerId: string;
  payerId: string;
  receivableMetaData: string | null;
  /** API response: reais with 2 decimal places */
  value: number;
  proposedValue: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
