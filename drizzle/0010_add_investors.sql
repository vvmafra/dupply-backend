PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_accounts` (
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
	CONSTRAINT `accounts_role_check` CHECK(`role` IN ('seller', 'risk_analyst', 'admin', 'investor'))
);
--> statement-breakpoint
INSERT INTO `__new_accounts`("id", "status", "email", "password_hash", "role", "refresh_token", "refresh_token_lookup", "created_at", "updated_at", "deleted_at") 
SELECT "id", "status", "email", "password_hash", "role", "refresh_token", "refresh_token_lookup", "created_at", "updated_at", "deleted_at" FROM `accounts`;
--> statement-breakpoint
DROP TABLE `accounts`;
--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);
--> statement-breakpoint
CREATE INDEX `accounts_role_idx` ON `accounts` (`role`);
--> statement-breakpoint
CREATE INDEX `accounts_refresh_token_lookup_idx` ON `accounts` (`refresh_token_lookup`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE TABLE `investors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`account_id` text NOT NULL UNIQUE REFERENCES `accounts`(`id`),
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `investors_account_id_idx` ON `investors` (`account_id`);
--> statement-breakpoint
CREATE TABLE `investor_deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`investor_id` text NOT NULL REFERENCES `investors`(`id`),
	`amount_cents` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`external_tx_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investor_deposits_idempotency_key_idx` ON `investor_deposits` (`investor_id`, `idempotency_key`);
--> statement-breakpoint
CREATE INDEX `investor_deposits_investor_id_idx` ON `investor_deposits` (`investor_id`);
