CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`refresh_token` text,
	`refresh_token_lookup` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `accounts_status_check` CHECK(`status` IN ('active', 'inactive')),
	CONSTRAINT `accounts_role_check` CHECK(`role` IN ('seller', 'risk_analyst', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);
--> statement-breakpoint
CREATE INDEX `accounts_role_idx` ON `accounts` (`role`);
--> statement-breakpoint
CREATE INDEX `accounts_refresh_token_lookup_idx` ON `accounts` (`refresh_token_lookup`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_receivables` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_user_id` text NOT NULL,
	`payer_user_id` text NOT NULL,
	`status` text NOT NULL,
	`value` text NOT NULL,
	`proposed_value` text,
	`receivable_md` text,
	`created_at_ms` text NOT NULL,
	`updated_at_ms` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_receivables`("id", "seller_user_id", "payer_user_id", "status", "value", "proposed_value", "receivable_md", "created_at_ms", "updated_at_ms") SELECT "id", "seller_user_id", "payer_user_id", "status", "value", "proposed_value", "receivable_md", "created_at_ms", "updated_at_ms" FROM `receivables`;
--> statement-breakpoint
DROP TABLE `receivables`;
--> statement-breakpoint
ALTER TABLE `__new_receivables` RENAME TO `receivables`;
--> statement-breakpoint
CREATE INDEX `receivables_seller_user_id_idx` ON `receivables` (`seller_user_id`);
--> statement-breakpoint
CREATE INDEX `receivables_payer_user_id_idx` ON `receivables` (`payer_user_id`);
--> statement-breakpoint
CREATE INDEX `receivables_status_idx` ON `receivables` (`status`);
--> statement-breakpoint
DROP TABLE `platform_users`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
