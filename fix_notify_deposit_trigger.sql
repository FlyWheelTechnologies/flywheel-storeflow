-- Fix: notify_deposit trigger was incorrectly pointing at send-receipt instead of notify-deposit
-- This caused every sale INSERT to send the receipt email TWICE.

-- Step 1: Drop the misconfigured trigger (already done, but safe to repeat)
DROP TRIGGER IF EXISTS notify_deposit ON public.sales;

-- Step 2: Recreate it pointing at the CORRECT notify-deposit edge function
-- NOTE: Never commit raw service_role keys to git. Replace <YOUR_SERVICE_ROLE_KEY> before running in Supabase SQL editor.
CREATE TRIGGER notify_deposit
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://xzdvgxwpaynpmphcmtqc.supabase.co/functions/v1/notify-deposit',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer <YOUR_SERVICE_ROLE_KEY>"}',
  '{}',
  '3000'
);
