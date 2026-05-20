DROP INDEX IF EXISTS `duplicata_chain_unique_on_chain_id`;
--> statement-breakpoint
DROP INDEX IF EXISTS `duplicata_chain_tx_hash_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `duplicata_chain_draft_id_idx`;
--> statement-breakpoint
ALTER TABLE `duplicata_drafts` RENAME TO `trade_bill_drafts`;
--> statement-breakpoint
ALTER TABLE `duplicata_chain_records` RENAME TO `trade_bill_chain_records`;
--> statement-breakpoint
ALTER TABLE `trade_bill_chain_records` RENAME COLUMN `chain_duplicata_id` TO `chain_bill_id`;
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_bill_chain_unique_on_chain_id` ON `trade_bill_chain_records` (`chain_bill_id`,`contract_id`,`network`);
--> statement-breakpoint
CREATE INDEX `trade_bill_chain_tx_hash_idx` ON `trade_bill_chain_records` (`tx_hash`);
--> statement-breakpoint
CREATE INDEX `trade_bill_chain_draft_id_idx` ON `trade_bill_chain_records` (`draft_id`);
