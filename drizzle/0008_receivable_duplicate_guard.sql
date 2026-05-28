ALTER TABLE `receivables` ADD `normalized_bill_number` text;
--> statement-breakpoint
ALTER TABLE `receivables` ADD `normalized_fiscal_document_key` text;
--> statement-breakpoint
UPDATE `receivables`
SET `normalized_bill_number` = upper(trim(json_extract(`receivable_meta_data`, '$.billNumber')))
WHERE `receivable_meta_data` IS NOT NULL
  AND json_type(json_extract(`receivable_meta_data`, '$.billNumber')) = 'text'
  AND length(trim(json_extract(`receivable_meta_data`, '$.billNumber'))) > 0;
--> statement-breakpoint
UPDATE `receivables`
SET `normalized_fiscal_document_key` = CASE
  WHEN json_extract(`receivable_meta_data`, '$.fiscalDocumentType') = 'other'
  THEN trim(json_extract(`receivable_meta_data`, '$.fiscalDocumentKey'))
  ELSE replace(replace(replace(replace(replace(
    trim(json_extract(`receivable_meta_data`, '$.fiscalDocumentKey')),
    '.', ''), '-', ''), '/', ''), ' ', ''), ',', '')
END
WHERE `receivable_meta_data` IS NOT NULL
  AND json_type(json_extract(`receivable_meta_data`, '$.fiscalDocumentKey')) = 'text'
  AND length(trim(json_extract(`receivable_meta_data`, '$.fiscalDocumentKey'))) > 0;
--> statement-breakpoint
CREATE INDEX `receivables_seller_bill_idx` ON `receivables` (`seller_id`,`normalized_bill_number`);
--> statement-breakpoint
CREATE INDEX `receivables_seller_fiscal_key_idx` ON `receivables` (`seller_id`,`normalized_fiscal_document_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `receivables_seller_bill_active_unique` ON `receivables` (`seller_id`,`normalized_bill_number`) WHERE "receivables"."deleted_at" IS NULL AND "receivables"."normalized_bill_number" IS NOT NULL AND "receivables"."status" IN ('created','under_review','offer','approved','confirmed','processing','completed','overdue');
--> statement-breakpoint
CREATE UNIQUE INDEX `receivables_seller_fiscal_key_active_unique` ON `receivables` (`seller_id`,`normalized_fiscal_document_key`) WHERE "receivables"."deleted_at" IS NULL AND "receivables"."normalized_fiscal_document_key" IS NOT NULL AND "receivables"."status" IN ('created','under_review','offer','approved','confirmed','processing','completed','overdue');
