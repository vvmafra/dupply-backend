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
CREATE INDEX `ramp_quotes_external_quote_id_idx` ON `ramp_quotes` (`external_quote_id`);