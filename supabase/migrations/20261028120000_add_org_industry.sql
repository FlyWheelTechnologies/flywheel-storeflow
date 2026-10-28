-- StoreFlow by Flywheel — Business Industry & Tailored Taxonomy Migration
-- Adds industry column to public.organizations to support tailored product categories on onboarding.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS industry text DEFAULT 'general_retail';

COMMENT ON COLUMN public.organizations.industry IS 'The business sector/industry (e.g., auto_parts, hardware_building, clothing_fashion, electronics_gadgets, supermarket_grocery, pharmacy_health, beauty_cosmetics, agriculture_farming, household_plastics, general_retail)';
