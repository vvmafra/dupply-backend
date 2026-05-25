import { check, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Postgres schema (Supabase). Keep in sync with `schema.ts` (SQLite). */
export const ACCOUNT_STATUSES = ["active", "inactive"] as const;
export const ACCOUNT_ROLES = ["seller", "risk_analyst", "admin"] as const;

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("active"),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenLookup: text("refresh_token_lookup"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "accounts_status_check",
      sql`${t.status} IN ('active', 'inactive')`,
    ),
    check(
      "accounts_role_check",
      sql`${t.role} IN ('seller', 'risk_analyst', 'admin')`,
    ),
    index("accounts_role_idx").on(t.role),
    index("accounts_refresh_token_lookup_idx").on(t.refreshTokenLookup),
  ],
);

export const rampQuotes = pgTable(
  "ramp_quotes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    provider: text("provider").notNull().default("etherfuse"),
    externalQuoteId: text("external_quote_id").notNull(),
    requestJson: text("request_json").notNull(),
    responseJson: text("response_json").notNull(),
    expiresAtMs: text("expires_at_ms"),
    status: text("status").notNull().default("active"),
    createdAtMs: text("created_at_ms").notNull(),
  },
  (t) => [index("ramp_quotes_external_quote_id_idx").on(t.externalQuoteId)],
);

export const rampOrders = pgTable(
  "ramp_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    rampQuoteId: text("ramp_quote_id")
      .notNull()
      .references(() => rampQuotes.id),
    externalOrderId: text("external_order_id").notNull(),
    status: text("status").notNull().default("created"),
    requestJson: text("request_json").notNull(),
    responseJson: text("response_json"),
    createdAtMs: text("created_at_ms").notNull(),
    updatedAtMs: text("updated_at_ms").notNull(),
  },
  (t) => [
    index("ramp_orders_external_order_id_idx").on(t.externalOrderId),
    index("ramp_orders_ramp_quote_id_idx").on(t.rampQuoteId),
  ],
);

export const tradeBillDrafts = pgTable("trade_bill_drafts", {
  id: text("id").primaryKey(),
  issuerPublicKey: text("issuer_public_key").notNull(),
  status: text("status").notNull().default("draft"),
  payloadJson: text("payload_json").notNull(),
  unsignedXdr: text("unsigned_xdr"),
  assembledJson: text("assembled_json"),
  simulationLedger: text("simulation_ledger"),
  predictedChainId: text("predicted_chain_id"),
  lastError: text("last_error"),
  createdAtMs: text("created_at_ms").notNull(),
  updatedAtMs: text("updated_at_ms").notNull(),
});

export const SELLER_STATUSES = ["created", "in_review", "active", "inactive"] as const;

export const sellers = pgTable(
  "sellers",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("created"),
    name: text("name").notNull(),
    companyMetaData: text("company_meta_data").notNull(),
    legalRepresentativeMetaData: text("legal_representative_meta_data").notNull(),
    businessRelationsMetaData: text("business_relations_meta_data").notNull(),
    accountId: text("account_id")
      .notNull()
      .unique()
      .references(() => accounts.id),
    walletId: text("wallet_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "sellers_status_check",
      sql`${t.status} IN ('created', 'in_review', 'active', 'inactive')`,
    ),
    index("sellers_status_idx").on(t.status),
    index("sellers_account_id_idx").on(t.accountId),
  ],
);

export const WALLET_STATUSES = ["active", "inactive"] as const;
export const WALLET_NETWORKS = ["testnet", "mainnet"] as const;
export const WALLET_TYPES = ["smart_account", "classic_wallet"] as const;
export const WALLET_PARENT_TYPES = ["seller", "platform"] as const;

export const wallets = pgTable(
  "wallets",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull().default("active"),
    network: text("network").notNull(),
    address: text("address").notNull(),
    type: text("type").notNull(),
    credentialId: text("credential_id"),
    secretEncrypted: text("secret_encrypted"),
    signerPublicKey: text("signer_public_key").notNull(),
    createdTxHash: text("created_tx_hash"),
    parentType: text("parent_type").notNull(),
    sellerId: text("seller_id").references(() => sellers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("wallets_status_check", sql`${t.status} IN ('active', 'inactive')`),
    check("wallets_network_check", sql`${t.network} IN ('testnet', 'mainnet')`),
    check(
      "wallets_type_check",
      sql`${t.type} IN ('smart_account', 'classic_wallet')`,
    ),
    check(
      "wallets_parent_type_check",
      sql`${t.parentType} IN ('seller', 'platform')`,
    ),
    index("wallets_seller_id_idx").on(t.sellerId),
    index("wallets_address_network_idx").on(t.address, t.network),
    uniqueIndex("wallets_seller_network_active_unique")
      .on(t.sellerId, t.network)
      .where(
        sql`${t.status} = 'active' AND ${t.parentType} = 'seller' AND ${t.deletedAt} IS NULL`,
      ),
  ],
);

export const payers = pgTable("payers", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("active"),
  legalName: text("legal_name").notNull(),
  email: text("email").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const receivables = pgTable(
  "receivables",
  {
    id: text("id").primaryKey(),
    status: text("status").notNull(),
    sellerId: text("seller_id").notNull().references(() => sellers.id),
    payerId: text("payer_id").notNull().references(() => payers.id),
    receivableMetaData: text("receivable_meta_data"),
    value: text("value").notNull(),
    proposedValue: text("proposed_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("receivables_seller_id_idx").on(t.sellerId),
    index("receivables_payer_id_idx").on(t.payerId),
    index("receivables_status_idx").on(t.status),
  ],
);

export const tradeBillChainRecords = pgTable(
  "trade_bill_chain_records",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => tradeBillDrafts.id),
    network: text("network").notNull(),
    contractId: text("contract_id").notNull(),
    chainBillId: text("chain_bill_id").notNull(),
    txHash: text("tx_hash").notNull(),
    ledger: text("ledger"),
    issuedAtLedger: text("issued_at_ledger"),
    createdAtMs: text("created_at_ms").notNull(),
  },
  (t) => [
    uniqueIndex("trade_bill_chain_unique_on_chain_id").on(
      t.chainBillId,
      t.contractId,
      t.network,
    ),
    index("trade_bill_chain_tx_hash_idx").on(t.txHash),
    index("trade_bill_chain_draft_id_idx").on(t.draftId),
  ],
);
