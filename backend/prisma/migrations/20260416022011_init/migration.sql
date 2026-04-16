-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(255) NULL,
    `last_name` VARCHAR(255) NULL,
    `role` VARCHAR(50) NOT NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profiles` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `phone_number` VARCHAR(32) NULL,
    `avatar_url` VARCHAR(2048) NULL,
    `avatar_blob_name` VARCHAR(1024) NULL,
    `is_private` BOOLEAN NOT NULL DEFAULT false,
    `trustworthiness_score` INTEGER NOT NULL DEFAULT 1,
    `rent_postings_count` INTEGER NOT NULL DEFAULT 0,
    `available_rent_postings_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `profiles_user_id_key`(`user_id`),
    UNIQUE INDEX `profiles_username_key`(`username`),
    INDEX `profiles_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `devices` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `device_id` VARCHAR(255) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `platform` VARCHAR(255) NULL,
    `user_agent` VARCHAR(1024) NULL,
    `last_ip_address` VARCHAR(255) NULL,
    `first_seen_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `last_seen_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `verified_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `devices_user_id_idx`(`user_id`),
    UNIQUE INDEX `devices_user_id_device_id_key`(`user_id`, `device_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `postings` (
    `id` VARCHAR(36) NOT NULL,
    `owner_id` VARCHAR(36) NOT NULL,
    `status` ENUM('draft', 'published', 'archived') NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `pricing_currency` VARCHAR(3) NOT NULL,
    `pricing` JSON NOT NULL,
    `tags` JSON NOT NULL,
    `attributes` JSON NOT NULL,
    `availability_status` ENUM('available', 'limited', 'unavailable') NOT NULL,
    `availability_notes` VARCHAR(500) NULL,
    `max_booking_duration_days` INTEGER NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `city` VARCHAR(120) NOT NULL,
    `region` VARCHAR(120) NOT NULL,
    `country` VARCHAR(120) NOT NULL,
    `postal_code` VARCHAR(32) NULL,
    `published_at` DATETIME(6) NULL,
    `archived_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `postings_owner_id_status_idx`(`owner_id`, `status`),
    INDEX `postings_status_published_at_idx`(`status`, `published_at`),
    INDEX `postings_country_region_city_idx`(`country`, `region`, `city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posting_photos` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `blob_url` VARCHAR(2048) NOT NULL,
    `blob_name` VARCHAR(1024) NOT NULL,
    `position` INTEGER NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `posting_photos_posting_id_idx`(`posting_id`),
    UNIQUE INDEX `posting_photos_posting_id_position_key`(`posting_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posting_availability_blocks` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `start_at` DATETIME(6) NOT NULL,
    `end_at` DATETIME(6) NOT NULL,
    `note` VARCHAR(255) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `posting_availability_blocks_posting_id_start_at_end_at_idx`(`posting_id`, `start_at`, `end_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_requests` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `renter_id` VARCHAR(36) NOT NULL,
    `owner_id` VARCHAR(36) NOT NULL,
    `status` ENUM('pending', 'approved', 'declined', 'expired') NOT NULL,
    `start_at` DATETIME(6) NOT NULL,
    `end_at` DATETIME(6) NOT NULL,
    `duration_days` INTEGER NOT NULL,
    `guest_count` INTEGER NOT NULL,
    `note` VARCHAR(1000) NULL,
    `pricing_currency` VARCHAR(3) NOT NULL,
    `pricing_snapshot` JSON NOT NULL,
    `daily_price_amount` DECIMAL(18, 2) NOT NULL,
    `estimated_total` DECIMAL(18, 2) NOT NULL,
    `decision_note` VARCHAR(1000) NULL,
    `approved_at` DATETIME(6) NULL,
    `declined_at` DATETIME(6) NULL,
    `expired_at` DATETIME(6) NULL,
    `converted_at` DATETIME(6) NULL,
    `conversion_reserved_at` DATETIME(6) NULL,
    `conversion_reservation_expires_at` DATETIME(6) NULL,
    `hold_expires_at` DATETIME(6) NOT NULL,
    `hold_block_id` VARCHAR(36) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `booking_requests_hold_block_id_key`(`hold_block_id`),
    INDEX `booking_requests_posting_id_status_start_at_idx`(`posting_id`, `status`, `start_at`),
    INDEX `booking_requests_posting_id_hold_expires_at_idx`(`posting_id`, `hold_expires_at`),
    INDEX `booking_requests_status_conversion_reservation_expires_at_idx`(`status`, `conversion_reservation_expires_at`),
    INDEX `booking_requests_owner_id_status_created_at_idx`(`owner_id`, `status`, `created_at`),
    INDEX `booking_requests_renter_id_status_created_at_idx`(`renter_id`, `status`, `created_at`),
    INDEX `booking_requests_status_hold_expires_at_idx`(`status`, `hold_expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rentings` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `booking_request_id` VARCHAR(36) NOT NULL,
    `renter_id` VARCHAR(36) NOT NULL,
    `owner_id` VARCHAR(36) NOT NULL,
    `status` ENUM('confirmed') NOT NULL,
    `start_at` DATETIME(6) NOT NULL,
    `end_at` DATETIME(6) NOT NULL,
    `duration_days` INTEGER NOT NULL,
    `guest_count` INTEGER NOT NULL,
    `pricing_currency` VARCHAR(3) NOT NULL,
    `pricing_snapshot` JSON NOT NULL,
    `daily_price_amount` DECIMAL(18, 2) NOT NULL,
    `estimated_total` DECIMAL(18, 2) NOT NULL,
    `confirmed_at` DATETIME(6) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `rentings_booking_request_id_key`(`booking_request_id`),
    INDEX `rentings_posting_id_status_start_at_idx`(`posting_id`, `status`, `start_at`),
    INDEX `rentings_renter_id_status_created_at_idx`(`renter_id`, `status`, `created_at`),
    INDEX `rentings_owner_id_status_created_at_idx`(`owner_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posting_search_outbox` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `operation` ENUM('upsert', 'delete') NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `available_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `processing_at` DATETIME(6) NULL,
    `processed_at` DATETIME(6) NULL,
    `last_error` VARCHAR(2048) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `posting_search_outbox_available_at_processed_at_processing_a_idx`(`available_at`, `processed_at`, `processing_at`),
    INDEX `posting_search_outbox_posting_id_operation_idx`(`posting_id`, `operation`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posting_view_events` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `owner_id` VARCHAR(36) NOT NULL,
    `viewer_hash` VARCHAR(128) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `ip_address_hash` VARCHAR(128) NULL,
    `user_agent_hash` VARCHAR(128) NULL,
    `device_type` VARCHAR(32) NOT NULL,
    `occurred_at` DATETIME(6) NOT NULL,
    `event_date` DATETIME(6) NOT NULL,
    `event_hour` DATETIME(6) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `posting_view_events_posting_id_event_date_idx`(`posting_id`, `event_date`),
    INDEX `posting_view_events_owner_id_event_date_idx`(`owner_id`, `event_date`),
    INDEX `posting_view_events_posting_id_event_hour_idx`(`posting_id`, `event_hour`),
    INDEX `posting_view_events_viewer_hash_event_date_idx`(`viewer_hash`, `event_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posting_analytics_unique_views` (
    `posting_id` VARCHAR(36) NOT NULL,
    `owner_id` VARCHAR(36) NOT NULL,
    `viewer_hash` VARCHAR(128) NOT NULL,
    `event_date` DATETIME(6) NOT NULL,
    `first_seen_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `posting_analytics_unique_views_owner_id_event_date_idx`(`owner_id`, `event_date`),
    PRIMARY KEY (`posting_id`, `event_date`, `viewer_hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posting_analytics_hourly` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `owner_id` VARCHAR(36) NOT NULL,
    `bucket_start` DATETIME(6) NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `unique_views` INTEGER NOT NULL DEFAULT 0,
    `booking_requests` INTEGER NOT NULL DEFAULT 0,
    `confirmed_bookings` INTEGER NOT NULL DEFAULT 0,
    `estimated_revenue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `posting_analytics_hourly_owner_id_bucket_start_idx`(`owner_id`, `bucket_start`),
    UNIQUE INDEX `posting_analytics_hourly_posting_id_bucket_start_key`(`posting_id`, `bucket_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posting_analytics_daily` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `owner_id` VARCHAR(36) NOT NULL,
    `bucket_start` DATETIME(6) NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `unique_views` INTEGER NOT NULL DEFAULT 0,
    `booking_requests` INTEGER NOT NULL DEFAULT 0,
    `confirmed_bookings` INTEGER NOT NULL DEFAULT 0,
    `estimated_revenue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `posting_analytics_daily_owner_id_bucket_start_idx`(`owner_id`, `bucket_start`),
    UNIQUE INDEX `posting_analytics_daily_posting_id_bucket_start_key`(`posting_id`, `bucket_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posting_analytics_outbox` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `owner_id` VARCHAR(36) NOT NULL,
    `event_type` ENUM('posting_viewed', 'booking_requested', 'booking_accepted', 'payment_captured') NOT NULL,
    `payload` JSON NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `available_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `processing_at` DATETIME(6) NULL,
    `processed_at` DATETIME(6) NULL,
    `last_error` VARCHAR(2048) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `posting_analytics_outbox_available_at_processed_at_processin_idx`(`available_at`, `processed_at`, `processing_at`),
    INDEX `posting_analytics_outbox_owner_id_event_type_idx`(`owner_id`, `event_type`),
    INDEX `posting_analytics_outbox_posting_id_event_type_idx`(`posting_id`, `event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posting_reviews` (
    `id` VARCHAR(36) NOT NULL,
    `posting_id` VARCHAR(36) NOT NULL,
    `reviewer_id` VARCHAR(36) NOT NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(120) NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `posting_reviews_posting_id_created_at_idx`(`posting_id`, `created_at`),
    INDEX `posting_reviews_reviewer_id_idx`(`reviewer_id`),
    UNIQUE INDEX `posting_reviews_posting_id_reviewer_id_key`(`posting_id`, `reviewer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `devices` ADD CONSTRAINT `devices_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `postings` ADD CONSTRAINT `postings_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posting_photos` ADD CONSTRAINT `posting_photos_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posting_availability_blocks` ADD CONSTRAINT `posting_availability_blocks_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_renter_id_fkey` FOREIGN KEY (`renter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_requests` ADD CONSTRAINT `booking_requests_hold_block_id_fkey` FOREIGN KEY (`hold_block_id`) REFERENCES `posting_availability_blocks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rentings` ADD CONSTRAINT `rentings_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rentings` ADD CONSTRAINT `rentings_booking_request_id_fkey` FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rentings` ADD CONSTRAINT `rentings_renter_id_fkey` FOREIGN KEY (`renter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rentings` ADD CONSTRAINT `rentings_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posting_search_outbox` ADD CONSTRAINT `posting_search_outbox_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posting_view_events` ADD CONSTRAINT `posting_view_events_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posting_analytics_hourly` ADD CONSTRAINT `posting_analytics_hourly_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posting_analytics_daily` ADD CONSTRAINT `posting_analytics_daily_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posting_analytics_outbox` ADD CONSTRAINT `posting_analytics_outbox_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posting_reviews` ADD CONSTRAINT `posting_reviews_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posting_reviews` ADD CONSTRAINT `posting_reviews_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
