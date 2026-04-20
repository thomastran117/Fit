ALTER TABLE `booking_requests`
  ADD COLUMN `contact_name` VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN `contact_email` VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN `contact_phone_number` VARCHAR(32) NULL;

