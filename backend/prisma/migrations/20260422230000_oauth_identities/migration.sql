-- CreateTable
CREATE TABLE `oauth_identities` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_user_id` VARCHAR(255) NOT NULL,
    `provider_email` VARCHAR(255) NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `display_name` VARCHAR(255) NULL,
    `linked_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `oauth_identities_provider_provider_user_id_key`(`provider`, `provider_user_id`),
    UNIQUE INDEX `oauth_identities_user_id_provider_key`(`user_id`, `provider`),
    INDEX `oauth_identities_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve existing OAuth-only accounts that stored the provider subject in password_hash.
INSERT INTO `oauth_identities` (
    `id`,
    `user_id`,
    `provider`,
    `provider_user_id`,
    `provider_email`,
    `email_verified`,
    `linked_at`,
    `created_at`,
    `updated_at`
)
SELECT
    UUID(),
    `id`,
    SUBSTRING_INDEX(SUBSTRING_INDEX(`password_hash`, ':', 2), ':', -1),
    SUBSTRING(
        `password_hash`,
        CHAR_LENGTH(CONCAT('oauth:', SUBSTRING_INDEX(SUBSTRING_INDEX(`password_hash`, ':', 2), ':', -1), ':')) + 1
    ),
    `email`,
    `email_verified`,
    `created_at`,
    `created_at`,
    `updated_at`
FROM `users`
WHERE `password_hash` LIKE 'oauth:%:%';

-- Password hashes now represent only local password credentials.
ALTER TABLE `users` MODIFY `password_hash` VARCHAR(255) NULL;
UPDATE `users`
SET `password_hash` = NULL
WHERE `password_hash` LIKE 'oauth:%:%';

-- AddForeignKey
ALTER TABLE `oauth_identities` ADD CONSTRAINT `oauth_identities_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
