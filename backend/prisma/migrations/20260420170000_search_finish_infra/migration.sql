ALTER TABLE `posting_search_outbox`
  MODIFY `posting_id` VARCHAR(36) NULL,
  ADD COLUMN `reindex_run_id` VARCHAR(36) NULL AFTER `posting_id`,
  ADD COLUMN `dedupe_key` VARCHAR(255) NOT NULL DEFAULT '' AFTER `operation`,
  ADD COLUMN `target_index_name` VARCHAR(191) NULL AFTER `dedupe_key`,
  ADD COLUMN `publish_attempts` INTEGER NOT NULL DEFAULT 0 AFTER `attempts`,
  ADD COLUMN `indexed_at` DATETIME(6) NULL AFTER `processed_at`,
  ADD COLUMN `dead_lettered_at` DATETIME(6) NULL AFTER `indexed_at`,
  ADD COLUMN `broker_message_id` VARCHAR(255) NULL AFTER `dead_lettered_at`;

UPDATE `posting_search_outbox`
SET `dedupe_key` = `id`
WHERE `dedupe_key` = '';

CREATE TABLE `search_reindex_runs` (
  `id` VARCHAR(36) NOT NULL,
  `status` ENUM('pending', 'running', 'waiting_for_catchup', 'completed', 'failed') NOT NULL,
  `target_index_name` VARCHAR(191) NOT NULL,
  `retained_index_name` VARCHAR(191) NULL,
  `source_snapshot_at` DATETIME(6) NOT NULL,
  `barrier_outbox_id` VARCHAR(36) NULL,
  `total_postings` INTEGER NOT NULL DEFAULT 0,
  `indexed_postings` INTEGER NOT NULL DEFAULT 0,
  `failed_postings` INTEGER NOT NULL DEFAULT 0,
  `started_at` DATETIME(6) NULL,
  `completed_at` DATETIME(6) NULL,
  `failed_at` DATETIME(6) NULL,
  `processing_at` DATETIME(6) NULL,
  `last_error` VARCHAR(2048) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE INDEX `search_reindex_runs_barrier_outbox_id_key`(`barrier_outbox_id`),
  INDEX `search_reindex_runs_status_created_at_idx`(`status`, `created_at`),
  INDEX `search_reindex_runs_processing_at_status_idx`(`processing_at`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `search_reindex_runs`
  MODIFY `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6);

CREATE INDEX `posting_search_outbox_available_at_processed_at_dead_lettered_a_idx`
  ON `posting_search_outbox`(`available_at`, `processed_at`, `dead_lettered_at`, `processing_at`);

CREATE INDEX `posting_search_outbox_reindex_run_id_indexed_at_dead_lette_idx`
  ON `posting_search_outbox`(`reindex_run_id`, `indexed_at`, `dead_lettered_at`);

CREATE INDEX `posting_search_outbox_target_index_name_indexed_at_dead_l_idx`
  ON `posting_search_outbox`(`target_index_name`, `indexed_at`, `dead_lettered_at`);

ALTER TABLE `posting_search_outbox`
  ADD CONSTRAINT `posting_search_outbox_reindex_run_id_fkey`
    FOREIGN KEY (`reindex_run_id`) REFERENCES `search_reindex_runs`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
