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
  setup_fee numeric DEFAULT 0,
  subscription_amount numeric DEFAULT 0,
  billing_cycle text DEFAULT 'monthly'::text,
  payment_status text DEFAULT 'active'::text,
  payment_terms text,
  tin text,
  is_vat_registered boolean DEFAULT false,
  default_tax_rate numeric DEFAULT 20.0,
  default_tax_inclusive boolean DEFAULT true,
  subscription_expires_at timestamp with time zone,
  last_payment_date timestamp with time zone,
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

-- 17. Tenant-Scoped Views (security_invoker = true)
CREATE OR REPLACE VIEW public.deposits WITH (security_invoker = true) AS
SELECT 
  c.id AS customer_id,
  c.name AS customer_name,
  c.phone,
  c.organization_id,
  COALESCE(COUNT(s.id) FILTER (
    WHERE (
      s.payment_status = 'DEPOSIT' 
      OR s.notes ILIKE '%Pure Deposit%' 
      OR s.total_amount = 0 
      OR s.balance_due < 0
    ) 
    AND (s.notes IS NULL OR s.notes NOT ILIKE '%(Fulfilled)%')
  ), 0)::integer AS pending_sales_count,
  MAX(s.created_at) AS last_sale_date,
  COALESCE(SUM(s.balance_due), 0)::numeric AS total_balance
FROM public.customers c
LEFT JOIN public.sales s ON s.customer_id = c.id
GROUP BY c.id, c.name, c.phone, c.organization_id;

CREATE OR REPLACE VIEW public.customer_stats WITH (security_invoker = true) AS
SELECT 
  c.id,
  c.name,
  c.phone,
  c.email,
  c.address,
  c.is_contractor,
  c.created_at,
  c.organization_id,
  COALESCE(SUM(s.total_amount), 0)::numeric AS total_spent,
  COALESCE(COUNT(s.id), 0)::integer AS transaction_count
FROM public.customers c
LEFT JOIN public.sales s ON s.customer_id = c.id
GROUP BY c.id, c.name, c.phone, c.email, c.address, c.is_contractor, c.created_at, c.organization_id;

-- 18. Hardened Multi-Tenant RPC Functions
CREATE OR REPLACE FUNCTION public.record_sale_transaction(
  p_customer_id integer,
  p_customer_name text, 
  p_total_amount numeric,
  p_amount_paid numeric, 
  p_payment_method text, 
  p_payment_status text,
  p_items jsonb,
  p_recorded_by text,
  p_tax_percentage numeric DEFAULT 0,
  p_tax_inclusive boolean DEFAULT TRUE,
  p_credit_used numeric DEFAULT 0,
  p_created_at timestamptz DEFAULT NULL,
  p_invoice_no text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sale_id UUID;
  v_tax_amount NUMERIC := 0;
  v_net_amount NUMERIC := 0;
  v_total_with_tax NUMERIC;
  v_item RECORD;
  v_org_id UUID;
  v_max_seq INTEGER;
BEGIN
  v_org_id := public.get_my_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;

  IF p_invoice_no IS NULL THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_no, '^INV-', ''), '')::integer), 0)
    INTO v_max_seq
    FROM public.sales
    WHERE invoice_no ~ '^INV-[0-9]+$'
      AND organization_id = v_org_id;
      
    p_invoice_no := 'INV-' || pg_catalog.lpad((v_max_seq + 1)::text, 3, '0');
  END IF;

  IF p_tax_inclusive THEN
    v_net_amount := ROUND(p_total_amount / (1 + (p_tax_percentage / 100)), 2);
    v_tax_amount := ROUND(p_total_amount - v_net_amount, 2);
    v_total_with_tax := ROUND(p_total_amount, 2);
  ELSE
    v_tax_amount := ROUND(p_total_amount * (p_tax_percentage / 100), 2);
    v_net_amount := ROUND(p_total_amount, 2);
    v_total_with_tax := ROUND(p_total_amount + v_tax_amount, 2);
  END IF;

  INSERT INTO public.sales (
    customer_id, customer_name, total_amount, amount_paid, 
    balance_due, payment_status, payment_method, recorded_by,
    tax_percentage, tax_inclusive, tax_amount, created_at, invoice_no, organization_id
  )
  VALUES (
    p_customer_id, p_customer_name, 
    v_total_with_tax, 
    ROUND(p_amount_paid + p_credit_used, 2),
    ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 2),
    p_payment_status, p_payment_method, p_recorded_by,
    p_tax_percentage, p_tax_inclusive, v_tax_amount,
    COALESCE(p_created_at, pg_catalog.now()),
    p_invoice_no,
    v_org_id
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal, organization_id)
    VALUES (v_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, ROUND(v_item.subtotal, 2), v_org_id);
    
    UPDATE public.products 
    SET stock_quantity = stock_quantity - v_item.quantity 
    WHERE id = v_item.product_id AND organization_id = v_org_id;
  END LOOP;

  INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at, organization_id) 
  VALUES (v_sale_id, 'REVENUE', v_net_amount, 'Revenue from Sale #' || v_sale_id, COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  
  IF v_tax_amount > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'TAX_PAYABLE', v_tax_amount, 'Tax collected', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;
  
  IF p_amount_paid > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, pg_catalog.upper(p_payment_method), ROUND(p_amount_paid, 2), 'Payment received', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;

  IF p_credit_used > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'CUSTOMER_DEPOSIT', ROUND(p_credit_used, 2), 'Applied from customer credit', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;
  
  IF (v_total_with_tax - (p_amount_paid + p_credit_used)) > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'ACCOUNTS_RECEIVABLE', ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 2), 'Debt recorded', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;

  RETURN v_sale_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_pure_deposit(
  p_customer_name text,
  p_customer_phone text,
  p_amount numeric,
  p_payment_method text,
  p_recorded_by text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id bigint;
  v_sale_id uuid;
  v_org_id uuid;
BEGIN
  v_org_id := public.get_my_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;
  
  SELECT id INTO v_customer_id 
  FROM public.customers 
  WHERE name = p_customer_name 
    AND (phone = p_customer_phone OR (phone IS NULL AND p_customer_phone IS NULL))
    AND organization_id = v_org_id
  ORDER BY id ASC
  LIMIT 1;
    
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, phone, organization_id)
    VALUES (p_customer_name, p_customer_phone, v_org_id)
    RETURNING id INTO v_customer_id;
  END IF;

  INSERT INTO public.sales (
    customer_id, customer_name, total_amount, amount_paid, 
    balance_due, payment_status, payment_method, recorded_by,
    notes, organization_id
  )
  VALUES (
    v_customer_id, p_customer_name, 0, p_amount, 
    -p_amount, 'DEPOSIT', p_payment_method, p_recorded_by,
    'Pure Deposit', v_org_id
  )
  RETURNING id INTO v_sale_id;

  INSERT INTO public.journal_entries (sale_id, account_type, debit, credit, description, organization_id)
  VALUES 
    (v_sale_id, pg_catalog.upper(p_payment_method), p_amount, 0, 'Deposit received from ' || p_customer_name, v_org_id),
    (v_sale_id, 'CUSTOMER_DEPOSIT', 0, p_amount, 'Customer credit recorded', v_org_id);

  RETURN v_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_sale(
  p_sale_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  v_org_id := public.get_my_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;

  UPDATE public.sales
  SET notes = CASE 
    WHEN notes IS NULL THEN '(Fulfilled)' 
    WHEN notes LIKE '%(Fulfilled)%' THEN notes 
    ELSE notes || ' (Fulfilled)' 
  END
  WHERE id = p_sale_id
    AND organization_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found or unauthorized for this organization';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_pure_deposit(
  p_sale_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total numeric := 0;
  v_amount_paid numeric;
  v_customer_id bigint;
  v_customer_name text;
  v_item record;
  v_org_id uuid;
  v_my_org_id uuid;
BEGIN
  v_my_org_id := public.get_my_organization_id();
  IF v_my_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;

  SELECT amount_paid, customer_id, customer_name, organization_id
  INTO v_amount_paid, v_customer_id, v_customer_name, v_org_id
  FROM public.sales
  WHERE id = p_sale_id;

  IF v_org_id IS NULL OR v_org_id IS DISTINCT FROM v_my_org_id THEN
    RAISE EXCEPTION 'Sale not found or unauthorized for this organization';
  END IF;

  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id uuid, product_name text, quantity numeric, unit_price numeric, subtotal numeric)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal, organization_id)
    VALUES (p_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.subtotal, v_org_id);
    
    UPDATE public.products 
    SET stock_quantity = stock_quantity - v_item.quantity 
    WHERE id = v_item.product_id AND organization_id = v_org_id;
    
    v_total := v_total + v_item.subtotal;
  END LOOP;

  UPDATE public.sales
  SET 
    total_amount = v_total,
    balance_due = v_total - v_amount_paid,
    notes = CASE 
      WHEN notes IS NULL THEN '(Fulfilled)' 
      WHEN notes LIKE '%(Fulfilled)%' THEN notes 
      ELSE notes || ' (Fulfilled)' 
    END
  WHERE id = p_sale_id AND organization_id = v_org_id;

  INSERT INTO public.journal_entries (sale_id, account_type, debit, credit, description, organization_id)
  VALUES 
    (p_sale_id, 'CUSTOMER_DEPOSIT', v_amount_paid, 0, 'Applied customer deposit to sale', v_org_id),
    (p_sale_id, 'REVENUE', 0, v_total, 'Revenue from fulfilled deposit', v_org_id);

  IF v_total > v_amount_paid THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, credit, description, organization_id)
    VALUES (p_sale_id, 'ACCOUNTS_RECEIVABLE', v_total - v_amount_paid, 0, 'Debt recorded for balance due', v_org_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_pure_deposit(text, text, numeric, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_sale(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_pure_deposit(uuid, jsonb) TO authenticated, service_role;

GRANT SELECT ON public.deposits TO authenticated, service_role;
GRANT SELECT ON public.customer_stats TO authenticated, service_role;