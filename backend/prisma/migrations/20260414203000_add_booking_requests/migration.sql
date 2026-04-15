ALTER TABLE `postings`
  ADD COLUMN `max_booking_duration_days` INTEGER NULL;

ALTER TABLE `posting_analytics_hourly`
  ADD COLUMN `confirmed_bookings` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `posting_analytics_daily`
  ADD COLUMN `confirmed_bookings` INTEGER NOT NULL DEFAULT 0;

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
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `booking_requests_hold_block_id_key` (`hold_block_id`),
  INDEX `booking_requests_posting_id_status_start_at_idx` (`posting_id`, `status`, `start_at`),
  INDEX `booking_requests_posting_id_hold_expires_at_idx` (`posting_id`, `hold_expires_at`),
  INDEX `booking_requests_status_conversion_reservation_expires_at_idx` (`status`, `conversion_reservation_expires_at`),
  INDEX `booking_requests_owner_id_status_created_at_idx` (`owner_id`, `status`, `created_at`),
  INDEX `booking_requests_renter_id_status_created_at_idx` (`renter_id`, `status`, `created_at`),
  INDEX `booking_requests_status_hold_expires_at_idx` (`status`, `hold_expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `booking_requests`
  ADD CONSTRAINT `booking_requests_posting_id_fkey`
    FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `booking_requests_renter_id_fkey`
    FOREIGN KEY (`renter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `booking_requests_owner_id_fkey`
    FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `booking_requests_hold_block_id_fkey`
    FOREIGN KEY (`hold_block_id`) REFERENCES `posting_availability_blocks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

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
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `rentings_booking_request_id_key` (`booking_request_id`),
  INDEX `rentings_posting_id_status_start_at_idx` (`posting_id`, `status`, `start_at`),
  INDEX `rentings_renter_id_status_created_at_idx` (`renter_id`, `status`, `created_at`),
  INDEX `rentings_owner_id_status_created_at_idx` (`owner_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `rentings`
  ADD CONSTRAINT `rentings_posting_id_fkey`
    FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `rentings_booking_request_id_fkey`
    FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `rentings_renter_id_fkey`
    FOREIGN KEY (`renter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `rentings_owner_id_fkey`
    FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
