-- StoreFlow Migration: Add Notification Settings & Automated Digests
-- Allows store owners to configure Daily Summaries (6 PM), Saturday Weekly Summaries (6 PM), and Alert Preferences.

-- 1. Add notification_settings column to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{
    "daily_summary": {
      "enabled": true,
      "time": "18:00"
    },
    "weekly_summary": {
      "enabled": true,
      "day": "saturday",
      "time": "18:00"
    },
    "low_stock_alerts": {
      "enabled": true
    },
    "deposit_alerts": {
      "enabled": true
    },
    "recipients": []
  }'::jsonb;

COMMENT ON COLUMN public.organizations.notification_settings IS 'Merchant alert and summary digest preferences (Daily 6PM, Saturday 6PM, Low Stock, Deposits, Custom emails)';

-- 2. Optional: pg_cron scheduling configuration in Supabase SQL Editor
-- Run these cron setups if pg_cron & pg_net are enabled on your Supabase project:
/*
-- Daily Digest at 6:00 PM UTC (18:00)
SELECT cron.schedule(
  'daily-store-sales-summary',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ongyutrabagetgdebdib.supabase.co/functions/v1/send-store-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('frequency', 'daily')
  ) AS request_id;
  $$
);

-- Weekly Executive Digest on Saturdays at 6:00 PM UTC (18:00)
SELECT cron.schedule(
  'weekly-store-executive-summary',
  '0 18 * * 6',
  $$
  SELECT net.http_post(
    url := 'https://ongyutrabagetgdebdib.supabase.co/functions/v1/send-store-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('frequency', 'weekly')
  ) AS request_id;
  $$
);
*/

