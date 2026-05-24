CREATE TABLE `sellers` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`name` text NOT NULL,
	`company_meta_data` text NOT NULL,
	`legal_representative_meta_data` text NOT NULL,
	`business_relations_meta_data` text NOT NULL,
	`account_id` text NOT NULL,
	`wallet_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `sellers_status_check` CHECK(`status` IN ('created', 'in_review', 'active', 'inactive'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sellers_account_id_unique` ON `sellers` (`account_id`);
--> statement-breakpoint
CREATE INDEX `sellers_status_idx` ON `sellers` (`status`);
--> statement-breakpoint
CREATE INDEX `sellers_account_id_idx` ON `sellers` (`account_id`);
