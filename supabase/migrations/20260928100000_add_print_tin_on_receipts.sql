-- StoreFlow Migration: 20260928_add_print_tin_on_receipts.sql
-- Purpose: Add print_tin_on_receipts flag to organizations table to prevent accidental printing of personal Ghana Card PINs

ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS print_tin_on_receipts boolean DEFAULT false;

COMMENT ON COLUMN public.organizations.print_tin_on_receipts IS 'Whether official business TIN should be printed on customer receipts. Personal Ghana Card PINs are strictly suppressed regardless of this setting for customer privacy and security.';

-- Invalidate PostgREST cache
NOTIFY pgrst, 'reload schema';
