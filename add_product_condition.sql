-- StoreFlow Migration: Add Product Condition (New vs Used)
-- Allows merchant storekeepers and admins to specify whether inventory items are Brand New or Used/Second-hand.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS condition text DEFAULT 'new' CHECK (condition IN ('new', 'used'));

COMMENT ON COLUMN public.products.condition IS 'Physical condition of the product: new (Brand New) or used (Pre-owned / Second-hand)';

