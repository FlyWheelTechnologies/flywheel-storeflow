-- StoreFlow Migration: 20260904_add_org_tax_settings.sql
-- Purpose: Add Ghana TIN, VAT status, and default tax preferences to organizations

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tin text,
  ADD COLUMN IF NOT EXISTS is_vat_registered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_tax_rate numeric DEFAULT 20.0,
  ADD COLUMN IF NOT EXISTS default_tax_inclusive boolean DEFAULT true;

-- Comment on columns for clarity
COMMENT ON COLUMN public.organizations.tin IS 'Ghana Revenue Authority TIN or Ghana Card PIN (e.g. C0012345678 or GHA-XXXXXXXXX-X)';
COMMENT ON COLUMN public.organizations.is_vat_registered IS 'Whether the organization is registered for VAT under Act 1151 (turnover >= GHS 750,000)';
COMMENT ON COLUMN public.organizations.default_tax_rate IS 'Default tax percentage applied at checkout (20.0 for unified, 15.0 for standard, 0.0 for exempt)';
COMMENT ON COLUMN public.organizations.default_tax_inclusive IS 'Whether store selling prices are entered tax-inclusive by default';
