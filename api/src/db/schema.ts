import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
