-- CreateTable
CREATE TABLE `personal_access_tokens` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `public_id` VARCHAR(32) NOT NULL,
    `token_prefix` VARCHAR(64) NOT NULL,
    `secret_hash` VARCHAR(255) NOT NULL,
    `scopes` JSON NOT NULL,
    `last_used_at` DATETIME(6) NULL,
    `expires_at` DATETIME(6) NULL,
    `revoked_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `personal_access_tokens_public_id_key`(`public_id`),
    INDEX `personal_access_tokens_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `personal_access_tokens_public_id_idx`(`public_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `personal_access_tokens` ADD CONSTRAINT `personal_access_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
