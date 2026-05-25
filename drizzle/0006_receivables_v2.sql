DROP TABLE IF EXISTS `receivables`;
--> statement-breakpoint
CREATE TABLE `payers` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`legal_name` text NOT NULL,
	`email` text NOT NULL,
	`cnpj` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payers_cnpj_unique` ON `payers` (`cnpj`);
--> statement-breakpoint
CREATE TABLE `receivables` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`seller_id` text NOT NULL,
	`payer_id` text NOT NULL,
	`receivable_meta_data` text,
	`value` text NOT NULL,
	`proposed_value` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payer_id`) REFERENCES `payers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receivables_seller_id_idx` ON `receivables` (`seller_id`);
--> statement-breakpoint
CREATE INDEX `receivables_payer_id_idx` ON `receivables` (`payer_id`);
--> statement-breakpoint
CREATE INDEX `receivables_status_idx` ON `receivables` (`status`);
