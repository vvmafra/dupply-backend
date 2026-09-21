CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`refresh_token` text,
	`refresh_token_lookup` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "accounts_status_check" CHECK("accounts"."status" IN ('active', 'inactive')),
	CONSTRAINT "accounts_role_check" CHECK("accounts"."role" IN ('seller', 'risk_analyst', 'admin', 'investor'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE INDEX `accounts_role_idx` ON `accounts` (`role`);--> statement-breakpoint
CREATE INDEX `accounts_refresh_token_lookup_idx` ON `accounts` (`refresh_token_lookup`);--> statement-breakpoint
CREATE TABLE `investor_deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`investor_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`external_tx_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`investor_id`) REFERENCES `investors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investor_deposits_idempotency_key_idx` ON `investor_deposits` (`investor_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `investor_deposits_investor_id_idx` ON `investor_deposits` (`investor_id`);--> statement-breakpoint
CREATE TABLE `investor_investments` (
	`id` text PRIMARY KEY NOT NULL,
	`investor_id` text NOT NULL,
	`receivable_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`investor_id`) REFERENCES `investors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receivable_id`) REFERENCES `receivables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investor_investments_idempotency_key_idx` ON `investor_investments` (`investor_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `investor_investments_investor_id_idx` ON `investor_investments` (`investor_id`);--> statement-breakpoint
CREATE INDEX `investor_investments_receivable_id_idx` ON `investor_investments` (`receivable_id`);--> statement-breakpoint
CREATE TABLE `investor_withdrawals` (
	`id` text PRIMARY KEY NOT NULL,
	`investor_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`pix_key` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`investor_id`) REFERENCES `investors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investor_withdrawals_idempotency_key_idx` ON `investor_withdrawals` (`investor_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `investor_withdrawals_investor_id_idx` ON `investor_withdrawals` (`investor_id`);--> statement-breakpoint
CREATE TABLE `investors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`account_id` text NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investors_account_id_unique` ON `investors` (`account_id`);--> statement-breakpoint
CREATE INDEX `investors_account_id_idx` ON `investors` (`account_id`);--> statement-breakpoint
CREATE TABLE `payers` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`legal_name` text NOT NULL,
	`email` text NOT NULL,
	`cnpj` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payers_cnpj_unique` ON `payers` (`cnpj`);--> statement-breakpoint
CREATE TABLE `ramp_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`ramp_quote_id` text NOT NULL,
	`external_order_id` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`request_json` text NOT NULL,
	`response_json` text,
	`created_at_ms` text NOT NULL,
	`updated_at_ms` text NOT NULL,
	FOREIGN KEY (`ramp_quote_id`) REFERENCES `ramp_quotes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ramp_orders_external_order_id_idx` ON `ramp_orders` (`external_order_id`);--> statement-breakpoint
CREATE INDEX `ramp_orders_ramp_quote_id_idx` ON `ramp_orders` (`ramp_quote_id`);--> statement-breakpoint
CREATE TABLE `ramp_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`provider` text DEFAULT 'etherfuse' NOT NULL,
	`external_quote_id` text NOT NULL,
	`request_json` text NOT NULL,
	`response_json` text NOT NULL,
	`expires_at_ms` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at_ms` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ramp_quotes_external_quote_id_idx` ON `ramp_quotes` (`external_quote_id`);--> statement-breakpoint
CREATE TABLE `receivables` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`seller_id` text NOT NULL,
	`payer_id` text NOT NULL,
	`receivable_meta_data` text,
	`ai_report` text,
	`ai_report_pdf_url` text,
	`normalized_bill_number` text,
	`normalized_fiscal_document_key` text,
	`value` text NOT NULL,
	`proposed_value` text,
	`status_history` text,
	`funded_cents` integer DEFAULT 0 NOT NULL,
	`target_funding_cents` integer DEFAULT 0 NOT NULL,
	`yield_rate_annual` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payer_id`) REFERENCES `payers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receivables_seller_id_idx` ON `receivables` (`seller_id`);--> statement-breakpoint
CREATE INDEX `receivables_payer_id_idx` ON `receivables` (`payer_id`);--> statement-breakpoint
CREATE INDEX `receivables_status_idx` ON `receivables` (`status`);--> statement-breakpoint
CREATE INDEX `receivables_seller_bill_idx` ON `receivables` (`seller_id`,`normalized_bill_number`);--> statement-breakpoint
CREATE INDEX `receivables_seller_fiscal_key_idx` ON `receivables` (`seller_id`,`normalized_fiscal_document_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `receivables_seller_bill_active_unique` ON `receivables` (`seller_id`,`normalized_bill_number`) WHERE "receivables"."deleted_at" IS NULL
          AND "receivables"."normalized_bill_number" IS NOT NULL
          AND "receivables"."status" IN ('created','under_review','offer','confirmed','funding','funded','processing','completed','overdue');--> statement-breakpoint
CREATE UNIQUE INDEX `receivables_seller_fiscal_key_active_unique` ON `receivables` (`seller_id`,`normalized_fiscal_document_key`) WHERE "receivables"."deleted_at" IS NULL
          AND "receivables"."normalized_fiscal_document_key" IS NOT NULL
          AND "receivables"."status" IN ('created','under_review','offer','confirmed','funding','funded','processing','completed','overdue');--> statement-breakpoint
CREATE TABLE `sellers` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`name` text NOT NULL,
	`company_meta_data` text NOT NULL,
	`legal_representative_meta_data` text NOT NULL,
	`business_relations_meta_data` text NOT NULL,
	`account_id` text NOT NULL,
	`wallet_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sellers_status_check" CHECK("sellers"."status" IN ('created', 'in_review', 'active', 'inactive'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sellers_account_id_unique` ON `sellers` (`account_id`);--> statement-breakpoint
CREATE INDEX `sellers_status_idx` ON `sellers` (`status`);--> statement-breakpoint
CREATE INDEX `sellers_account_id_idx` ON `sellers` (`account_id`);--> statement-breakpoint
CREATE TABLE `trade_bill_chain_records` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`network` text NOT NULL,
	`contract_id` text NOT NULL,
	`chain_bill_id` text NOT NULL,
	`tx_hash` text NOT NULL,
	`ledger` text,
	`issued_at_ledger` text,
	`created_at_ms` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `trade_bill_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_bill_chain_unique_on_chain_id` ON `trade_bill_chain_records` (`chain_bill_id`,`contract_id`,`network`);--> statement-breakpoint
CREATE INDEX `trade_bill_chain_tx_hash_idx` ON `trade_bill_chain_records` (`tx_hash`);--> statement-breakpoint
CREATE INDEX `trade_bill_chain_draft_id_idx` ON `trade_bill_chain_records` (`draft_id`);--> statement-breakpoint
CREATE TABLE `trade_bill_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer_public_key` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payload_json` text NOT NULL,
	`unsigned_xdr` text,
	`assembled_json` text,
	`simulation_ledger` text,
	`predicted_chain_id` text,
	`last_error` text,
	`created_at_ms` text NOT NULL,
	`updated_at_ms` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`network` text NOT NULL,
	`address` text NOT NULL,
	`type` text NOT NULL,
	`credential_id` text,
	`secret_encrypted` text,
	`signer_public_key` text NOT NULL,
	`created_tx_hash` text,
	`parent_type` text NOT NULL,
	`seller_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "wallets_status_check" CHECK("wallets"."status" IN ('active', 'inactive')),
	CONSTRAINT "wallets_network_check" CHECK("wallets"."network" IN ('testnet', 'mainnet')),
	CONSTRAINT "wallets_type_check" CHECK("wallets"."type" IN ('smart_account', 'classic_wallet')),
	CONSTRAINT "wallets_parent_type_check" CHECK("wallets"."parent_type" IN ('seller', 'platform'))
);
--> statement-breakpoint
CREATE INDEX `wallets_seller_id_idx` ON `wallets` (`seller_id`);--> statement-breakpoint
CREATE INDEX `wallets_address_network_idx` ON `wallets` (`address`,`network`);--> statement-breakpoint
CREATE UNIQUE INDEX `wallets_seller_network_active_unique` ON `wallets` (`seller_id`,`network`) WHERE "wallets"."status" = 'active' AND "wallets"."parent_type" = 'seller' AND "wallets"."deleted_at" IS NULL;