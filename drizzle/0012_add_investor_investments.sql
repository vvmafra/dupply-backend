ALTER TABLE `receivables` ADD COLUMN `funded_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `receivables` ADD COLUMN `target_funding_cents` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `receivables` ADD COLUMN `yield_rate_annual` real NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `investor_investments` (
	`id` text PRIMARY KEY NOT NULL,
	`investor_id` text NOT NULL REFERENCES `investors`(`id`),
	`receivable_id` text NOT NULL REFERENCES `receivables`(`id`),
	`amount_cents` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investor_investments_idempotency_key_idx` ON `investor_investments` (`investor_id`, `idempotency_key`);
--> statement-breakpoint
CREATE INDEX `investor_investments_investor_id_idx` ON `investor_investments` (`investor_id`);
--> statement-breakpoint
CREATE INDEX `investor_investments_receivable_id_idx` ON `investor_investments` (`receivable_id`);
