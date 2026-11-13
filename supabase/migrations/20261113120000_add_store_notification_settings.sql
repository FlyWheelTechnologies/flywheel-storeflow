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

