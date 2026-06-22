UPDATE `receivables`
SET `status` = 'confirmed', `updated_at` = unixepoch()
WHERE `status` = 'approved';
--> statement-breakpoint
DROP INDEX IF EXISTS `receivables_seller_bill_active_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `receivables_seller_bill_active_unique` ON `receivables` (`seller_id`,`normalized_bill_number`) WHERE "receivables"."deleted_at" IS NULL AND "receivables"."normalized_bill_number" IS NOT NULL AND "receivables"."status" IN ('created','under_review','offer','confirmed','processing','completed','overdue');
--> statement-breakpoint
DROP INDEX IF EXISTS `receivables_seller_fiscal_key_active_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `receivables_seller_fiscal_key_active_unique` ON `receivables` (`seller_id`,`normalized_fiscal_document_key`) WHERE "receivables"."deleted_at" IS NULL AND "receivables"."normalized_fiscal_document_key" IS NOT NULL AND "receivables"."status" IN ('created','under_review','offer','confirmed','processing','completed','overdue');
