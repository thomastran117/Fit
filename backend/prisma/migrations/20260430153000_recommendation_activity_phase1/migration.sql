ALTER TABLE `profiles`
  ADD COLUMN `recommendation_personalization_enabled` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `recommendation_activities` (
  `id` VARCHAR(36) NOT NULL,
  `aggregation_key` VARCHAR(255) NOT NULL,
  `event_type` ENUM(
    'posting_view',
    'search_click',
    'booking_request_created',
    'renting_confirmed',
    'posting_published',
    'posting_unpaused',
    'posting_paused',
    'posting_archived'
  ) NOT NULL,
  `source` ENUM(
    'posting_detail',
    'search_results',
    'booking_flow',
    'renting_flow',
    'posting_lifecycle'
  ) NOT NULL,
  `occurred_at` DATETIME(6) NOT NULL,
  `posting_id` VARCHAR(36) NOT NULL,
  `owner_id` VARCHAR(36) NOT NULL,
  `actor_user_id` VARCHAR(36) NULL,
  `anonymous_actor_hash` VARCHAR(128) NULL,
  `device_type` VARCHAR(32) NOT NULL,
  `request_id` VARCHAR(255) NULL,
  `search_session_id` VARCHAR(255) NULL,
  `metadata` JSON NULL,
  `count` INTEGER NOT NULL DEFAULT 1,
  `first_occurred_at` DATETIME(6) NOT NULL,
  `last_occurred_at` DATETIME(6) NOT NULL,
  `personalization_eligible` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `recommendation_activities_aggregation_key_key`(`aggregation_key`),
  INDEX `recommendation_activities_posting_event_last_idx`(`posting_id`, `event_type`, `last_occurred_at`),
  INDEX `recommendation_activities_actor_personalization_last_idx`(`actor_user_id`, `personalization_eligible`, `last_occurred_at`),
  INDEX `recommendation_activities_anonymous_event_last_idx`(`anonymous_actor_hash`, `event_type`, `last_occurred_at`),
  INDEX `recommendation_activities_owner_event_last_idx`(`owner_id`, `event_type`, `last_occurred_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recommendation_refresh_jobs` (
  `id` VARCHAR(36) NOT NULL,
  `job_type` ENUM('user_refresh', 'popular_refresh') NOT NULL,
  `dedupe_key` VARCHAR(255) NOT NULL,
  `user_id` VARCHAR(36) NULL,
  `segment_type` ENUM('global', 'family', 'family_subtype') NULL,
  `segment_value` VARCHAR(191) NULL,
  `available_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `processing_at` DATETIME(6) NULL,
  `processed_at` DATETIME(6) NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `last_error` VARCHAR(2048) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `recommendation_refresh_jobs_dedupe_key_key`(`dedupe_key`),
  INDEX `recommendation_refresh_jobs_ready_idx`(`available_at`, `processed_at`, `processing_at`),
  INDEX `recommendation_refresh_jobs_job_user_idx`(`job_type`, `user_id`),
  INDEX `recommendation_refresh_jobs_job_segment_idx`(`job_type`, `segment_type`, `segment_value`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `recommendation_activities`
  ADD CONSTRAINT `recommendation_activities_posting_id_fkey`
  FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
