ALTER TABLE `postings`
  ADD COLUMN `family` ENUM('place', 'equipment', 'vehicle') NOT NULL DEFAULT 'equipment' AFTER `status`,
  ADD COLUMN `subtype` VARCHAR(50) NOT NULL DEFAULT 'general_equipment' AFTER `family`;

UPDATE `postings`
SET
  `family` = 'equipment',
  `subtype` = 'general_equipment'
WHERE `family` = 'equipment'
  AND `subtype` = 'general_equipment';

ALTER TABLE `postings`
  ALTER COLUMN `family` DROP DEFAULT,
  ALTER COLUMN `subtype` DROP DEFAULT;

CREATE INDEX `postings_status_family_subtype_published_at_idx`
  ON `postings`(`status`, `family`, `subtype`, `published_at`);
