-- StoreFlow Commercial SaaS — Tenant Billing & Payment History Schema
-- Adds setup fees, recurring subscription rates, payment terms, expiration dates,
-- and creates the subscription_payments ledger table for verified revenue tracking.

-- 1. Add Billing & Subscription columns to public.organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS setup_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'one_time', 'custom')),
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'active' CHECK (payment_status IN ('active', 'pending', 'overdue', 'trial', 'cancelled')),
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_date timestamptz;

-- Index for fast expiration & renewal watchlist queries
CREATE INDEX IF NOT EXISTS idx_orgs_sub_expires ON public.organizations(subscription_expires_at);


-- 2. Create subscription_payments ledger table
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_type text DEFAULT 'subscription' CHECK (payment_type IN ('setup_fee', 'subscription', 'renewal', 'upgrade', 'other')),
  payment_method text DEFAULT 'MoMo' CHECK (payment_method IN ('MoMo', 'Bank Transfer', 'Cash', 'Cheque', 'Card', 'Other')),
  reference_no text,
  notes text,
  recorded_by text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT subscription_payments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_org_id ON public.subscription_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_created ON public.subscription_payments(created_at DESC);


-- 3. Enable RLS & Policies on subscription_payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage subscription_payments" ON public.subscription_payments;
CREATE POLICY "Super admins can manage subscription_payments" ON public.subscription_payments
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS "Org members can view their own subscription payments" ON public.subscription_payments;
CREATE POLICY "Org members can view their own subscription payments" ON public.subscription_payments
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));


-- 4. Explicit API Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO anon, authenticated, service_role;
