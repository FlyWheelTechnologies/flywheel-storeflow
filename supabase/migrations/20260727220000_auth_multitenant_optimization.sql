-- StoreFlow by Flywheel — Auth & Multi-Tenant Database Optimization Migration
-- Adds database indexes for multi-tenant isolation, hardens helper functions,
-- scopes RLS policies with subquery evaluation & WITH CHECK clauses,
-- and automatically synchronizes profiles with auth.users app_metadata.

-- 1. Create B-Tree Indexes on organization_id across all multi-tenant tables
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON public.customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_organization_id ON public.sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_organization_id ON public.sale_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_organization_id ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_organization_id ON public.journal_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_logs_organization_id ON public.logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_logs_organization_id ON public.platform_logs(organization_id);

-- Composite Indexes for High-Frequency Operational Queries
CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(organization_id, id);
CREATE INDEX IF NOT EXISTS idx_sales_org_created ON public.sales(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_org_sale ON public.sale_items(organization_id, sale_id);


-- 2. Hardened RLS Helper Functions (SECURITY DEFINER with empty search_path)
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


-- 3. Hardened & Scoped RLS Policies (TO authenticated, Subquery Evaluation & WITH CHECK)

-- --- Organizations Policies ---
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org members can view their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update their own organization" ON public.organizations;

CREATE POLICY "Super admins can manage all organizations" ON public.organizations
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

CREATE POLICY "Org members can view their own organization" ON public.organizations
  TO authenticated FOR SELECT USING (id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org admins can update their own organization" ON public.organizations
  TO authenticated FOR UPDATE
  USING (id = (SELECT public.get_my_organization_id()) AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'admin')
  WITH CHECK (id = (SELECT public.get_my_organization_id()));


-- --- Platform Logs Policies ---
DROP POLICY IF EXISTS "Super admins can view all platform logs" ON public.platform_logs;
DROP POLICY IF EXISTS "Super admins can insert platform logs" ON public.platform_logs;

CREATE POLICY "Super admins can view all platform logs" ON public.platform_logs
  TO authenticated FOR SELECT USING ((SELECT public.is_super_admin()));

CREATE POLICY "Super admins can insert platform logs" ON public.platform_logs
  TO authenticated FOR INSERT WITH CHECK ((SELECT public.is_super_admin()));


-- --- Profiles Policies ---
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Org members can read profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;

CREATE POLICY "Super admins can manage all profiles" ON public.profiles
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

CREATE POLICY "Org members can read profiles in their org" ON public.profiles
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Users can update their own profile" ON public.profiles
  TO authenticated FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Allow users to insert their own profile" ON public.profiles
  TO authenticated FOR INSERT WITH CHECK (id = (SELECT auth.uid()));


-- --- Products Policies ---
DROP POLICY IF EXISTS "Super admins can manage all products" ON public.products;
DROP POLICY IF EXISTS "Org members can manage products" ON public.products;

CREATE POLICY "Super admins can manage all products" ON public.products
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

CREATE POLICY "Org members can select products" ON public.products
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can insert products" ON public.products
  TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can update products" ON public.products
  TO authenticated FOR UPDATE
  USING (organization_id = (SELECT public.get_my_organization_id()))
  WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can delete products" ON public.products
  TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));


-- --- Sales Policies ---
DROP POLICY IF EXISTS "Super admins can manage all sales" ON public.sales;
DROP POLICY IF EXISTS "Org members can manage sales" ON public.sales;

CREATE POLICY "Super admins can manage all sales" ON public.sales
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

CREATE POLICY "Org members can select sales" ON public.sales
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can insert sales" ON public.sales
  TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can update sales" ON public.sales
  TO authenticated FOR UPDATE
  USING (organization_id = (SELECT public.get_my_organization_id()))
  WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can delete sales" ON public.sales
  TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));


-- --- Sale Items Policies ---
DROP POLICY IF EXISTS "Super admins can manage all sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Org members can manage sale_items" ON public.sale_items;

CREATE POLICY "Super admins can manage all sale_items" ON public.sale_items
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

CREATE POLICY "Org members can select sale_items" ON public.sale_items
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can insert sale_items" ON public.sale_items
  TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can update sale_items" ON public.sale_items
  TO authenticated FOR UPDATE
  USING (organization_id = (SELECT public.get_my_organization_id()))
  WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can delete sale_items" ON public.sale_items
  TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));


-- --- Customers Policies ---
DROP POLICY IF EXISTS "Super admins can manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Org members can manage customers" ON public.customers;

CREATE POLICY "Super admins can manage all customers" ON public.customers
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

CREATE POLICY "Org members can select customers" ON public.customers
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can insert customers" ON public.customers
  TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can update customers" ON public.customers
  TO authenticated FOR UPDATE
  USING (organization_id = (SELECT public.get_my_organization_id()))
  WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can delete customers" ON public.customers
  TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));


-- --- Expenses Policies ---
DROP POLICY IF EXISTS "Super admins can manage all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Org members can manage expenses" ON public.expenses;

CREATE POLICY "Super admins can manage all expenses" ON public.expenses
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

CREATE POLICY "Org members can select expenses" ON public.expenses
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can insert expenses" ON public.expenses
  TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can update expenses" ON public.expenses
  TO authenticated FOR UPDATE
  USING (organization_id = (SELECT public.get_my_organization_id()))
  WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can delete expenses" ON public.expenses
  TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));


-- --- Journal Entries Policies ---
DROP POLICY IF EXISTS "Super admins can manage all journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Org members can manage journal_entries" ON public.journal_entries;

CREATE POLICY "Super admins can manage all journal_entries" ON public.journal_entries
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

CREATE POLICY "Org members can select journal_entries" ON public.journal_entries
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can insert journal_entries" ON public.journal_entries
  TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can update journal_entries" ON public.journal_entries
  TO authenticated FOR UPDATE
  USING (organization_id = (SELECT public.get_my_organization_id()))
  WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can delete journal_entries" ON public.journal_entries
  TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));


-- --- Logs Policies ---
DROP POLICY IF EXISTS "Super admins can manage all logs" ON public.logs;
DROP POLICY IF EXISTS "Org members can manage logs" ON public.logs;

CREATE POLICY "Super admins can manage all logs" ON public.logs
  TO authenticated FOR ALL USING ((SELECT public.is_super_admin()));

CREATE POLICY "Org members can select logs" ON public.logs
  TO authenticated FOR SELECT USING (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can insert logs" ON public.logs
  TO authenticated FOR INSERT WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can update logs" ON public.logs
  TO authenticated FOR UPDATE
  USING (organization_id = (SELECT public.get_my_organization_id()))
  WITH CHECK (organization_id = (SELECT public.get_my_organization_id()));

CREATE POLICY "Org members can delete logs" ON public.logs
  TO authenticated FOR DELETE USING (organization_id = (SELECT public.get_my_organization_id()));


-- 4. App Metadata Sync Trigger Function (Syncs profiles role/org to auth.users app_metadata)
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


-- 5. Updated handle_new_user trigger function
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
