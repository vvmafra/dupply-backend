CREATE TABLE `platform_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`password_hash` text,
	`principal_kind` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`service_api_key_hash` text,
	`created_at_ms` text NOT NULL,
	`updated_at_ms` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_users_email_unique` ON `platform_users` (`email`);
--> statement-breakpoint
CREATE INDEX `platform_users_role_idx` ON `platform_users` (`role`);
--> statement-breakpoint
CREATE TABLE `receivables` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_user_id` text NOT NULL,
	`payer_user_id` text NOT NULL,
	`status` text NOT NULL,
	`value` text NOT NULL,
	`proposed_value` text,
	`receivable_md` text,
	`created_at_ms` text NOT NULL,
	`updated_at_ms` text NOT NULL,
	FOREIGN KEY (`seller_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payer_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receivables_seller_user_id_idx` ON `receivables` (`seller_user_id`);
--> statement-breakpoint
CREATE INDEX `receivables_payer_user_id_idx` ON `receivables` (`payer_user_id`);
--> statement-breakpoint
CREATE INDEX `receivables_status_idx` ON `receivables` (`status`);
