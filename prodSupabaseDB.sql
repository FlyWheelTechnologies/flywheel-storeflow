-- StoreFlow by Flywheel — Complete Multi-Tenant Database Schema
-- Table creation order, constraints, helper functions, indexes, RLS, and explicit grants.

-- 1. Create organizations table
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#f97316'::text,
  currency text DEFAULT 'GHS'::text,
  admin_email text,
  phone text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);

-- 2. Create platform_logs table
CREATE TABLE public.platform_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  organization_name text,
  action text NOT NULL,
  details text,
  user_email text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT platform_logs_pkey PRIMARY KEY (id)
);

-- 3. Create profiles table
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  full_name text,
  role text DEFAULT 'storekeeper'::text CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'storekeeper'::text, 'auditor'::text])),
  avatar_url text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- 4. Create customers table
CREATE TABLE public.customers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  is_contractor boolean DEFAULT false,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

-- 5. Create products table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT 'General'::text,
  buying_uom text DEFAULT 'pcs'::text,
  selling_uom text DEFAULT 'pcs'::text,
  conversion_factor numeric DEFAULT 1,
  cost_price numeric DEFAULT 0,
  selling_price numeric DEFAULT 0,
  stock_quantity numeric DEFAULT 0,
  low_stock_threshold integer DEFAULT 10,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  item_code text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

-- 6. Create sales table
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id bigint REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text DEFAULT 'Walk-in Customer'::text,
  attendant_email text,
  total_amount numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  balance_due numeric DEFAULT 0,
  payment_status text DEFAULT 'PAID'::text CHECK (payment_status = ANY (ARRAY['PAID'::text, 'PARTIAL'::text, 'DEPOSIT'::text, 'UNPAID'::text])),
  payment_method text DEFAULT 'Cash'::text,
  notes text,
  recorded_by text,
  created_at timestamp with time zone DEFAULT now(),
  invoice_no text,
  tax_percentage numeric DEFAULT 0,
  tax_inclusive boolean DEFAULT true,
  tax_amount numeric DEFAULT 0,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT sales_pkey PRIMARY KEY (id)
);

-- 7. Create sale_items table
CREATE TABLE public.sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text,
  quantity numeric,
  unit_price numeric,
  subtotal numeric,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT sale_items_pkey PRIMARY KEY (id)
);

-- 8. Create expenses table
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  description text NOT NULL,
  category text DEFAULT 'Misc'::text,
  amount numeric NOT NULL,
  recorded_by text,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT expenses_pkey PRIMARY KEY (id)
);

-- 9. Create journal_entries table
CREATE TABLE public.journal_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  account_type text,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT journal_entries_pkey PRIMARY KEY (id)
);

-- 10. Create logs table
CREATE TABLE public.logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_email text,
  user_role text,
  action text,
  details text,
  ip_address text,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT logs_pkey PRIMARY KEY (id)
);

-- 11. Multi-Tenant Performance B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON public.customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_organization_id ON public.sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_organization_id ON public.sale_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_organization_id ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_organization_id ON public.journal_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_logs_organization_id ON public.logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_logs_organization_id ON public.platform_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(organization_id, id);
CREATE INDEX IF NOT EXISTS idx_sales_org_created ON public.sales(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_org_sale ON public.sale_items(organization_id, sale_id);

-- 12. Helper Functions for Row Level Security (RLS)
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
  );
$$;

-- 13. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- 14. Create RLS Policies
CREATE POLICY "Super admins can manage all organizations" ON public.organizations
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));
CREATE POLICY "Org members can view their own organization" ON public.organizations
  TO authenticated FOR SELECT USING (id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org admins can update their own organization" ON public.organizations
  TO authenticated FOR UPDATE
  USING (id = (SELECT public.get_my_organization_id()) AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin')
  WITH CHECK (id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Super admins can view all platform logs" ON public.platform_logs
  TO authenticated FOR SELECT USING ((SELECT public.is_super_admin()));
CREATE POLICY "Super admins can insert platform logs" ON public.platform_logs
  TO authenticated FOR INSERT WITH CHECK ((SELECT public.is_super_admin()));

CREATE POLICY "Super admins can manage all profiles" ON public.profiles
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));
CREATE POLICY "Users can read their own profile" ON public.profiles
  TO authenticated FOR SELECT USING (id = (SELECT auth.uid()));
CREATE POLICY "Org members can read profiles in their org" ON public.profiles
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Users can update their own profile" ON public.profiles
  TO authenticated FOR UPDATE USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "Allow users to insert their own profile" ON public.profiles
  TO authenticated FOR INSERT WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Super admins can manage all products" ON public.products TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));
CREATE POLICY "Org members can select products" ON public.products TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can insert products" ON public.products TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can update products" ON public.products TO authenticated FOR UPDATE USING (organization_id = (SELECT public.get_my_organization_id())) WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can delete products" ON public.products TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Super admins can manage all sales" ON public.sales TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));
CREATE POLICY "Org members can select sales" ON public.sales TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can insert sales" ON public.sales TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can update sales" ON public.sales TO authenticated FOR UPDATE USING (organization_id = (SELECT public.get_my_organization_id())) WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can delete sales" ON public.sales TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Super admins can manage all sale_items" ON public.sale_items TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));
CREATE POLICY "Org members can select sale_items" ON public.sale_items TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can insert sale_items" ON public.sale_items TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can update sale_items" ON public.sale_items TO authenticated FOR UPDATE USING (organization_id = (SELECT public.get_my_organization_id())) WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can delete sale_items" ON public.sale_items TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Super admins can manage all customers" ON public.customers TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));
CREATE POLICY "Org members can select customers" ON public.customers TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can insert customers" ON public.customers TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can update customers" ON public.customers TO authenticated FOR UPDATE USING (organization_id = (SELECT public.get_my_organization_id())) WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can delete customers" ON public.customers TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Super admins can manage all expenses" ON public.expenses TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));
CREATE POLICY "Org members can select expenses" ON public.expenses TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can insert expenses" ON public.expenses TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can update expenses" ON public.expenses TO authenticated FOR UPDATE USING (organization_id = (SELECT public.get_my_organization_id())) WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can delete expenses" ON public.expenses TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Super admins can manage all journal_entries" ON public.journal_entries TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));
CREATE POLICY "Org members can select journal_entries" ON public.journal_entries TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can insert journal_entries" ON public.journal_entries TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can update journal_entries" ON public.journal_entries TO authenticated FOR UPDATE USING (organization_id = (SELECT public.get_my_organization_id())) WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can delete journal_entries" ON public.journal_entries TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Super admins can manage all logs" ON public.logs TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));
CREATE POLICY "Org members can select logs" ON public.logs TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can insert logs" ON public.logs TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can update logs" ON public.logs TO authenticated FOR UPDATE USING (organization_id = (SELECT public.get_my_organization_id())) WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));
CREATE POLICY "Org members can delete logs" ON public.logs TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));

-- 15. Triggers for Profile <-> App Metadata Synchronization & New Auth User Initialization
CREATE OR REPLACE FUNCTION public.sync_profile_to_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = pg_catalog.coalesce(raw_app_meta_data, '{}'::jsonb) || 
    pg_catalog.jsonb_build_object(
      'organization_id', NEW.organization_id,
      'role', NEW.role
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated_sync_app_metadata ON public.profiles;
CREATE TRIGGER on_profile_updated_sync_app_metadata
  AFTER INSERT OR UPDATE OF organization_id, role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_app_metadata();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL AND NEW.raw_user_meta_data->>'organization_id' != '' THEN
    v_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'storekeeper'),
    v_org_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 16. Explicit API grants for secure defaults compatibility
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;