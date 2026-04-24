ALTER TABLE `postings`
  MODIFY `status` ENUM('draft', 'published', 'paused', 'archived') NOT NULL,
  ADD COLUMN `paused_at` DATETIME(6) NULL AFTER `published_at`;
