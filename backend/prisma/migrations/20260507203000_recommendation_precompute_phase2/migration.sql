CREATE TABLE `user_recommendation_profiles` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `qualified` BOOLEAN NOT NULL DEFAULT false,
  `activity_window_start_at` DATETIME(6) NOT NULL,
  `last_signal_at` DATETIME(6) NULL,
  `distinct_posting_count` INTEGER NOT NULL DEFAULT 0,
  `signal_counts` JSON NOT NULL,
  `family_affinities` JSON NOT NULL,
  `subtype_affinities` JSON NOT NULL,
  `tag_affinities` JSON NOT NULL,
  `rebuilt_at` DATETIME(6) NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `user_recommendation_profiles_user_id_key`(`user_id`),
  INDEX `user_recommendation_profiles_qualified_rebuilt_at_idx`(`qualified`, `rebuilt_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_recommendation_snapshots` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `generated_at` DATETIME(6) NOT NULL,
  `source_last_signal_at` DATETIME(6) NULL,
  `candidate_count` INTEGER NOT NULL DEFAULT 0,
  `candidates` JSON NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `user_recommendation_snapshots_user_id_key`(`user_id`),
  INDEX `user_recommendation_snapshots_generated_at_idx`(`generated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `popular_recommendation_snapshots` (
  `id` VARCHAR(36) NOT NULL,
  `segment_type` ENUM('global', 'family', 'family_subtype') NOT NULL,
  `segment_value` VARCHAR(191) NOT NULL,
  `generated_at` DATETIME(6) NOT NULL,
  `source_last_signal_at` DATETIME(6) NULL,
  `candidate_count` INTEGER NOT NULL DEFAULT 0,
  `candidates` JSON NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `popular_recommendation_snapshots_segment_type_segment_value_key`(`segment_type`, `segment_value`),
  INDEX `popular_recommendation_snapshots_generated_at_idx`(`generated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_recommendation_profiles`
  ADD CONSTRAINT `user_recommendation_profiles_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_recommendation_snapshots`
  ADD CONSTRAINT `user_recommendation_snapshots_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
