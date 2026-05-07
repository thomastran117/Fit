ALTER TABLE `posting_analytics_hourly`
  ADD COLUMN `search_impressions` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `search_clicks` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `approved_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `declined_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `expired_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `cancelled_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `payment_failed_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `estimated_confirmed_revenue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `refunded_revenue` DECIMAL(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE `posting_analytics_daily`
  ADD COLUMN `search_impressions` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `search_clicks` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `approved_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `declined_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `expired_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `cancelled_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `payment_failed_requests` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `estimated_confirmed_revenue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `refunded_revenue` DECIMAL(18, 2) NOT NULL DEFAULT 0;

UPDATE `posting_analytics_hourly`
SET `estimated_confirmed_revenue` = `estimated_revenue`;

UPDATE `posting_analytics_daily`
SET `estimated_confirmed_revenue` = `estimated_revenue`;

ALTER TABLE `posting_analytics_hourly`
  DROP COLUMN `estimated_revenue`;

ALTER TABLE `posting_analytics_daily`
  DROP COLUMN `estimated_revenue`;

ALTER TABLE `posting_analytics_outbox`
  MODIFY COLUMN `event_type` ENUM(
    'posting_viewed',
    'search_impression',
    'search_click',
    'booking_requested',
    'booking_approved',
    'booking_declined',
    'booking_expired',
    'booking_cancelled',
    'payment_failed',
    'refund_recorded',
    'renting_confirmed'
  ) NOT NULL;
