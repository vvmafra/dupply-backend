import { index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

/** Postgres schema (Supabase). Keep in sync with `schema.ts` (SQLite). */
export const platformUsers = pgTable(
  "platform_users",
  {
    id: text("id").primaryKey(),
    email: text("email").unique(),
    passwordHash: text("password_hash"),
    principalKind: text("principal_kind").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    serviceApiKeyHash: text("service_api_key_hash"),
    createdAtMs: text("created_at_ms").notNull(),
    updatedAtMs: text("updated_at_ms").notNull(),
  },
  (t) => [index("platform_users_role_idx").on(t.role)],
);

export const receivables = pgTable(
  "receivables",
  {
    id: text("id").primaryKey(),
    sellerUserId: text("seller_user_id")
      .notNull()
      .references(() => platformUsers.id),
    payerUserId: text("payer_user_id")
      .notNull()
      .references(() => platformUsers.id),
    status: text("status").notNull(),
    value: text("value").notNull(),
    proposedValue: text("proposed_value"),
    receivableMd: text("receivable_md"),
    createdAtMs: text("created_at_ms").notNull(),
    updatedAtMs: text("updated_at_ms").notNull(),
  },
  (t) => [
    index("receivables_seller_user_id_idx").on(t.sellerUserId),
    index("receivables_payer_user_id_idx").on(t.payerUserId),
    index("receivables_status_idx").on(t.status),
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
