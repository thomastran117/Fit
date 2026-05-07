ALTER TABLE `posting_photos`
  ADD COLUMN `thumbnail_blob_url` VARCHAR(2048) NULL,
  ADD COLUMN `thumbnail_blob_name` VARCHAR(1024) NULL;
