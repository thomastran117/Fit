ALTER TABLE `posting_photos`
  ADD COLUMN `thumbnail_blob_url` VARCHAR(2048) NULL,
  ADD COLUMN `thumbnail_blob_name` VARCHAR(1024) NULL;

CREATE TABLE `posting_thumbnail_outbox` (
  `id` VARCHAR(36) NOT NULL,
  `posting_id` VARCHAR(36) NOT NULL,
  `dedupe_key` VARCHAR(255) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `available_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `processing_at` DATETIME(6) NULL,
  `processed_at` DATETIME(6) NULL,
  `dead_lettered_at` DATETIME(6) NULL,
  `last_error` VARCHAR(2048) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `posting_thumbnail_outbox_dedupe_key_key`(`dedupe_key`),
  INDEX `pt_outbox_ready_idx`(`available_at`, `processed_at`, `dead_lettered_at`, `processing_at`),
  INDEX `posting_thumbnail_outbox_posting_id_idx`(`posting_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `posting_thumbnail_outbox`
  ADD CONSTRAINT `posting_thumbnail_outbox_posting_id_fkey`
  FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
