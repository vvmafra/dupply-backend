CREATE TABLE `duplicata_chain_records` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`network` text NOT NULL,
	`contract_id` text NOT NULL,
	`chain_duplicata_id` text NOT NULL,
	`tx_hash` text NOT NULL,
	`ledger` text,
	`issued_at_ledger` text,
	`created_at_ms` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `duplicata_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `duplicata_chain_unique_on_chain_id` ON `duplicata_chain_records` (`chain_duplicata_id`,`contract_id`,`network`);--> statement-breakpoint
CREATE INDEX `duplicata_chain_tx_hash_idx` ON `duplicata_chain_records` (`tx_hash`);--> statement-breakpoint
CREATE INDEX `duplicata_chain_draft_id_idx` ON `duplicata_chain_records` (`draft_id`);--> statement-breakpoint
CREATE TABLE `duplicata_drafts` (
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
