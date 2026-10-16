-- StoreFlow by Flywheel — Hardware & Thermal Receipt Printer Settings
-- Adds columns to public.organizations to support POS hardware, thermal receipt printers, and cash drawers.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS receipt_paper_width text DEFAULT '80mm',
  ADD COLUMN IF NOT EXISTS receipt_mode text DEFAULT 'browser',
  ADD COLUMN IF NOT EXISTS auto_print_receipt boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS kick_cash_drawer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_footer_note text DEFAULT 'Thank you for your business!';

COMMENT ON COLUMN public.organizations.receipt_paper_width IS 'Paper roll width: 80mm (standard POS) or 58mm (compact mobile)';
COMMENT ON COLUMN public.organizations.receipt_mode IS 'Printing strategy: browser (HTML/kiosk), webusb (direct USB), bluetooth (mobile BLE)';
COMMENT ON COLUMN public.organizations.auto_print_receipt IS 'Whether to trigger printing immediately when cashier clicks Complete Sale';
COMMENT ON COLUMN public.organizations.kick_cash_drawer IS 'Whether to send an ESC/POS drawer kick pulse (ESC p) on cash checkout';
COMMENT ON COLUMN public.organizations.receipt_footer_note IS 'Custom footer greeting or policy note printed at the bottom of customer receipts';
