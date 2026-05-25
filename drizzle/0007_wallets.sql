CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`network` text NOT NULL,
	`address` text NOT NULL,
	`type` text NOT NULL,
	`credential_id` text,
	`secret_encrypted` text,
	`signer_public_key` text NOT NULL,
	`created_tx_hash` text,
	`parent_type` text NOT NULL,
	`seller_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `wallets_status_check` CHECK(`status` IN ('active', 'inactive')),
	CONSTRAINT `wallets_network_check` CHECK(`network` IN ('testnet', 'mainnet')),
	CONSTRAINT `wallets_type_check` CHECK(`type` IN ('smart_account', 'classic_wallet')),
	CONSTRAINT `wallets_parent_type_check` CHECK(`parent_type` IN ('seller', 'platform'))
);
--> statement-breakpoint
CREATE INDEX `wallets_seller_id_idx` ON `wallets` (`seller_id`);
--> statement-breakpoint
CREATE INDEX `wallets_address_network_idx` ON `wallets` (`address`,`network`);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallets_seller_network_active_unique` ON `wallets` (`seller_id`,`network`) WHERE "wallets"."status" = 'active' AND "wallets"."parent_type" = 'seller' AND "wallets"."deleted_at" IS NULL;
