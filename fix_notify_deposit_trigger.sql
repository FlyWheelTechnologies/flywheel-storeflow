-- Fix: notify_deposit trigger was incorrectly pointing at send-receipt instead of notify-deposit
-- This caused every sale INSERT to send the receipt email TWICE.

-- Step 1: Drop the misconfigured trigger (already done, but safe to repeat)
DROP TRIGGER IF EXISTS notify_deposit ON public.sales;

-- Step 2: Recreate it pointing at the CORRECT notify-deposit edge function
CREATE TRIGGER notify_deposit
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://xzdvgxwpaynpmphcmtqc.supabase.co/functions/v1/notify-deposit',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6ZHZneHdwYXlucG1waGNtdHFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ1NTM5MiwiZXhwIjoyMDk0MDMxMzkyfQ.M9p8hS7NAFIAvDRRFlm9-NbdVcCEJ6EK7ueSZ4MqqXE"}',
  '{}',
  '3000'
);
