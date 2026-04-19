ALTER TABLE `booking_requests`
  MODIFY `status` ENUM(
    'pending',
    'approved',
    'awaiting_payment',
    'payment_processing',
    'paid',
    'payment_failed',
    'declined',
    'expired',
    'cancelled',
    'refunded'
  ) NOT NULL,
  ADD COLUMN `payment_required_at` DATETIME(6) NULL,
  ADD COLUMN `payment_failed_at` DATETIME(6) NULL,
  ADD COLUMN `cancelled_at` DATETIME(6) NULL,
  ADD COLUMN `refunded_at` DATETIME(6) NULL,
  ADD COLUMN `payment_reconciliation_required` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `payments` (
  `id` VARCHAR(36) NOT NULL,
  `booking_request_id` VARCHAR(36) NOT NULL,
  `posting_id` VARCHAR(36) NOT NULL,
  `renter_id` VARCHAR(36) NOT NULL,
  `owner_id` VARCHAR(36) NOT NULL,
  `provider` ENUM('square') NOT NULL,
  `status` ENUM(
    'awaiting_method',
    'processing',
    'succeeded',
    'failed_retryable',
    'failed_final',
    'cancelled',
    'refunded',
    'partially_refunded'
  ) NOT NULL,
  `pricing_currency` VARCHAR(3) NOT NULL,
  `rental_subtotal_amount` DECIMAL(18, 2) NOT NULL,
  `platform_fee_amount` DECIMAL(18, 2) NOT NULL,
  `total_amount` DECIMAL(18, 2) NOT NULL,
  `square_payment_id` VARCHAR(128) NULL,
  `square_order_id` VARCHAR(128) NULL,
  `square_location_id` VARCHAR(128) NULL,
  `checkout_url` VARCHAR(2048) NULL,
  `last_attempted_at` DATETIME(6) NULL,
  `succeeded_at` DATETIME(6) NULL,
  `failed_at` DATETIME(6) NULL,
  `cancelled_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `payments_booking_request_id_key`(`booking_request_id`),
  UNIQUE INDEX `payments_square_payment_id_key`(`square_payment_id`),
  UNIQUE INDEX `payments_square_order_id_key`(`square_order_id`),
  INDEX `payments_renter_id_status_created_at_idx`(`renter_id`, `status`, `created_at`),
  INDEX `payments_owner_id_status_created_at_idx`(`owner_id`, `status`, `created_at`),
  INDEX `payments_status_created_at_idx`(`status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payment_attempts` (
  `id` VARCHAR(36) NOT NULL,
  `payment_id` VARCHAR(36) NOT NULL,
  `idempotency_key` VARCHAR(255) NOT NULL,
  `status` ENUM('pending', 'processing', 'succeeded', 'failed_retryable', 'failed_final') NOT NULL,
  `retry_count` INTEGER NOT NULL DEFAULT 0,
  `failure_category` ENUM('transient', 'permanent', 'unknown') NULL,
  `failure_code` VARCHAR(255) NULL,
  `failure_message` VARCHAR(2048) NULL,
  `provider_request_id` VARCHAR(255) NULL,
  `square_payment_id` VARCHAR(128) NULL,
  `request_payload` JSON NULL,
  `response_payload` JSON NULL,
  `next_retry_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `payment_attempts_idempotency_key_key`(`idempotency_key`),
  INDEX `payment_attempts_payment_id_created_at_idx`(`payment_id`, `created_at`),
  INDEX `payment_attempts_status_next_retry_at_idx`(`status`, `next_retry_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `refunds` (
  `id` VARCHAR(36) NOT NULL,
  `payment_id` VARCHAR(36) NOT NULL,
  `issued_by_user_id` VARCHAR(36) NULL,
  `status` ENUM('pending', 'succeeded', 'failed') NOT NULL,
  `amount` DECIMAL(18, 2) NOT NULL,
  `reason` VARCHAR(1000) NULL,
  `idempotency_key` VARCHAR(255) NOT NULL,
  `square_refund_id` VARCHAR(128) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `completed_at` DATETIME(6) NULL,

  UNIQUE INDEX `refunds_idempotency_key_key`(`idempotency_key`),
  UNIQUE INDEX `refunds_square_refund_id_key`(`square_refund_id`),
  INDEX `refunds_payment_id_created_at_idx`(`payment_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payouts` (
  `id` VARCHAR(36) NOT NULL,
  `payment_id` VARCHAR(36) NOT NULL,
  `owner_id` VARCHAR(36) NOT NULL,
  `status` ENUM('scheduled', 'released', 'failed') NOT NULL,
  `amount` DECIMAL(18, 2) NOT NULL,
  `due_at` DATETIME(6) NOT NULL,
  `released_at` DATETIME(6) NULL,
  `failed_at` DATETIME(6) NULL,
  `square_payout_id` VARCHAR(128) NULL,
  `failure_message` VARCHAR(2048) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `payouts_payment_id_key`(`payment_id`),
  UNIQUE INDEX `payouts_square_payout_id_key`(`square_payout_id`),
  INDEX `payouts_owner_id_status_due_at_idx`(`owner_id`, `status`, `due_at`),
  INDEX `payouts_status_due_at_idx`(`status`, `due_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payment_webhook_events` (
  `id` VARCHAR(36) NOT NULL,
  `payment_id` VARCHAR(36) NULL,
  `provider` ENUM('square') NOT NULL,
  `provider_event_id` VARCHAR(255) NOT NULL,
  `event_type` VARCHAR(255) NOT NULL,
  `signature_valid` BOOLEAN NOT NULL,
  `raw_payload` JSON NOT NULL,
  `processed_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  UNIQUE INDEX `payment_webhook_events_provider_event_id_key`(`provider_event_id`),
  INDEX `payment_webhook_events_provider_event_type_created_at_idx`(`provider`, `event_type`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `payment_ledger_entries` (
  `id` VARCHAR(36) NOT NULL,
  `payment_id` VARCHAR(36) NOT NULL,
  `type` ENUM('charge_created', 'charge_succeeded', 'refund_issued', 'payout_scheduled', 'payout_released') NOT NULL,
  `amount` DECIMAL(18, 2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

  INDEX `payment_ledger_entries_payment_id_created_at_idx`(`payment_id`, `created_at`),
  INDEX `payment_ledger_entries_type_created_at_idx`(`type`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `payments`
  ADD CONSTRAINT `payments_booking_request_id_fkey` FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payments_posting_id_fkey` FOREIGN KEY (`posting_id`) REFERENCES `postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payments_renter_id_fkey` FOREIGN KEY (`renter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payments_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `payment_attempts`
  ADD CONSTRAINT `payment_attempts_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `refunds`
  ADD CONSTRAINT `refunds_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `refunds_issued_by_user_id_fkey` FOREIGN KEY (`issued_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `payouts`
  ADD CONSTRAINT `payouts_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payouts_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `payment_webhook_events`
  ADD CONSTRAINT `payment_webhook_events_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `payment_ledger_entries`
  ADD CONSTRAINT `payment_ledger_entries_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
