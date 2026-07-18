-- Migration: Multi-Tenancy Setup for StoreFlow by Flywheel
-- This migration sets up the database for multi-tenant isolation, 
-- introduces the super_admin role, and defines RLS policies.

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#f97316',
  currency TEXT DEFAULT 'GHS',
  admin_email TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create platform_logs table
CREATE TABLE IF NOT EXISTS public.platform_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  organization_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Modify profiles table role constraint and add organization_id
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'admin', 'storekeeper', 'auditor'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 4. Add organization_id to all other data tables
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5. Helper Functions for Row Level Security (RLS)
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6. Enable Row Level Security on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- 7. Organizations Policies
CREATE POLICY "Super admins can manage all organizations" ON public.organizations FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can view their own organization" ON public.organizations FOR SELECT USING (id = public.get_my_organization_id());
CREATE POLICY "Org admins can update their own organization" ON public.organizations FOR UPDATE USING (id = public.get_my_organization_id() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- 8. Platform Logs Policies
CREATE POLICY "Super admins can view all platform logs" ON public.platform_logs FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins can insert platform logs" ON public.platform_logs FOR INSERT WITH CHECK (public.is_super_admin());

-- 9. Profiles Policies
CREATE POLICY "Super admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can read profiles in their org" ON public.profiles FOR SELECT USING (organization_id = public.get_my_organization_id());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- 10. Data Tables Policies (Super Admin or Org Scoped)
CREATE POLICY "Super admins can manage all products" ON public.products FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can manage products" ON public.products FOR ALL USING (organization_id = public.get_my_organization_id());

CREATE POLICY "Super admins can manage all sales" ON public.sales FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can manage sales" ON public.sales FOR ALL USING (organization_id = public.get_my_organization_id());

CREATE POLICY "Super admins can manage all sale_items" ON public.sale_items FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can manage sale_items" ON public.sale_items FOR ALL USING (organization_id = public.get_my_organization_id());

CREATE POLICY "Super admins can manage all customers" ON public.customers FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can manage customers" ON public.customers FOR ALL USING (organization_id = public.get_my_organization_id());

CREATE POLICY "Super admins can manage all expenses" ON public.expenses FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can manage expenses" ON public.expenses FOR ALL USING (organization_id = public.get_my_organization_id());

CREATE POLICY "Super admins can manage all journal_entries" ON public.journal_entries FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can manage journal_entries" ON public.journal_entries FOR ALL USING (organization_id = public.get_my_organization_id());

CREATE POLICY "Super admins can manage all logs" ON public.logs FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can manage logs" ON public.logs FOR ALL USING (organization_id = public.get_my_organization_id());

-- 11. Grant Table and Sequence Privileges explicitly for Secure Defaults
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
