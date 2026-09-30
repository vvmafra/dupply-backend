ALTER TABLE `receivables` ADD `yield_rate_monthly` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `receivables` ADD `min_investment_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `receivables` DROP COLUMN `yield_rate_annual`;