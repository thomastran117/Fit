ALTER TABLE `posting_availability_blocks`
  ADD COLUMN `source` ENUM('owner', 'booking_hold', 'renting') NOT NULL DEFAULT 'owner' AFTER `note`;

UPDATE `posting_availability_blocks` pab
INNER JOIN `booking_requests` br
  ON br.`hold_block_id` = pab.`id`
SET pab.`source` = 'booking_hold';

UPDATE `posting_availability_blocks` pab
INNER JOIN `rentings` r
  ON r.`posting_id` = pab.`posting_id`
  AND r.`start_at` = pab.`start_at`
  AND r.`end_at` = pab.`end_at`
  AND pab.`note` = CONCAT('Renting confirmed from booking request: ', r.`booking_request_id`)
SET pab.`source` = 'renting'
WHERE pab.`source` = 'owner';

CREATE INDEX `posting_availability_blocks_posting_id_source_start_at_end_idx`
  ON `posting_availability_blocks`(`posting_id`, `source`, `start_at`, `end_at`);
