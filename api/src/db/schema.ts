import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rampQuotes = sqliteTable(
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

export const rampOrders = sqliteTable(
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

export const duplicataDrafts = sqliteTable("duplicata_drafts", {
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

export const duplicataChainRecords = sqliteTable(
  "duplicata_chain_records",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => duplicataDrafts.id),
    network: text("network").notNull(),
    contractId: text("contract_id").notNull(),
    chainDuplicataId: text("chain_duplicata_id").notNull(),
    txHash: text("tx_hash").notNull(),
    ledger: text("ledger"),
    issuedAtLedger: text("issued_at_ledger"),
    createdAtMs: text("created_at_ms").notNull(),
  },
  (t) => [
    uniqueIndex("duplicata_chain_unique_on_chain_id").on(
      t.chainDuplicataId,
      t.contractId,
      t.network,
    ),
    index("duplicata_chain_tx_hash_idx").on(t.txHash),
    index("duplicata_chain_draft_id_idx").on(t.draftId),
  ],
);
