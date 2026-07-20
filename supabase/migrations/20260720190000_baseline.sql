-- StoreFlow by Flywheel — Complete Multi-Tenant Database Schema Baseline
-- Table creation order, constraints, helper functions, triggers, RLS, and explicit grants.

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
  invoice_no text, -- Changed to text to support INV-001 formatting
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


-- 11. Helper Functions for Row Level Security (RLS)
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


-- 12. Enable Row Level Security (RLS) on all tables
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


-- 13. Create RLS Policies
-- Organizations
CREATE POLICY "Super admins can manage all organizations" ON public.organizations FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can view their own organization" ON public.organizations FOR SELECT USING (id = public.get_my_organization_id());
CREATE POLICY "Org admins can update their own organization" ON public.organizations FOR UPDATE USING (id = public.get_my_organization_id() AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Platform Logs
CREATE POLICY "Super admins can view all platform logs" ON public.platform_logs FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Super admins can insert platform logs" ON public.platform_logs FOR INSERT WITH CHECK (public.is_super_admin());

-- Profiles
CREATE POLICY "Super admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_super_admin());
CREATE POLICY "Org members can read profiles in their org" ON public.profiles FOR SELECT USING (organization_id = public.get_my_organization_id());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Data Tables Policies
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


-- 14. Helper trigger function to create profile row automatically for new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'storekeeper'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger to execute handle_new_user after signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- 15. Helper log_action function for auditing database activities
CREATE OR REPLACE FUNCTION public.log_action(
  p_action text,
  p_details text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_email text;
  v_user_role text;
  v_org_id uuid;
BEGIN
  SELECT email, role, organization_id
  INTO v_user_email, v_user_role, v_org_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- Fallback if not logged in (e.g. system or triggers run during signup)
  IF v_user_email IS NULL THEN
    v_user_email := 'system';
    v_user_role := 'storekeeper';
  END IF;

  INSERT INTO public.logs (user_email, user_role, action, details, organization_id)
  VALUES (v_user_email, v_user_role, p_action, p_details, v_org_id);
END;
$$;


-- 16. Trigger function to log product changes
CREATE OR REPLACE FUNCTION public.trig_log_product_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.log_action('PRODUCT_CREATE', 'Added ' || NEW.name || COALESCE(' (Code: ' || NEW.item_code || ')', ''));
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.stock_quantity != NEW.stock_quantity) THEN
      PERFORM public.log_action('STOCK_ADJUST', 'Product ' || NEW.name || ' stock changed from ' || OLD.stock_quantity || ' to ' || NEW.stock_quantity);
    ELSE
      PERFORM public.log_action('PRODUCT_UPDATE', 'Modified ' || NEW.name);
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.log_action('PRODUCT_DELETE', 'Removed ' || OLD.name);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger to execute trig_log_product_change on products table
CREATE OR REPLACE TRIGGER log_product_change
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.trig_log_product_change();


-- 17. Explicit API grants for secure defaults compatibility
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
