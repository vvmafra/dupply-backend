CREATE TABLE `investor_withdrawals` (
	`id` text PRIMARY KEY NOT NULL,
	`investor_id` text NOT NULL REFERENCES `investors`(`id`),
	`amount_cents` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`pix_key` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `investor_withdrawals_idempotency_key_idx` ON `investor_withdrawals` (`investor_id`, `idempotency_key`);
--> statement-breakpoint
CREATE INDEX `investor_withdrawals_investor_id_idx` ON `investor_withdrawals` (`investor_id`);
