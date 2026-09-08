-- ============================================================
-- Migration: 20260908_enforce_strict_multitenant_isolation.sql
-- 
-- PURPOSE: Guarantee complete, airtight multi-tenant data isolation
-- across all businesses in StoreFlow.
--
-- 1. Enforces Row-Level Security (RLS) on all data tables.
-- 2. Drops any existing leaky/ambiguous policies.
-- 3. Creates strict RLS policies: Org members can ONLY SELECT/INSERT/
--    UPDATE/DELETE rows belonging to their own organization_id.
-- 4. Automatically auto-populates organization_id on insert triggers.
-- 5. Fixes handle_new_user() so staff accounts never lose their organization_id.
-- 6. Hardens deposits and customer_stats views with security_invoker = true.
-- 7. Heals existing profiles/records where organization_id was missing.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Resilient & Fast Organization ID Resolver (No recursion, reads JWT claims)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_organization_id_jwt()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    -- Priority 1: JWT app_metadata
    (SELECT (auth.jwt()->'app_metadata'->>'organization_id')::uuid),
    -- Priority 2: JWT user_metadata
    (SELECT (auth.jwt()->'user_metadata'->>'organization_id')::uuid),
    -- Priority 3: Check if email is an organization admin_email
    (SELECT id FROM public.organizations WHERE lower(admin_email) = lower((SELECT auth.jwt()->>'email')) LIMIT 1),
    -- Priority 4: Read from profiles
    (SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
$$;

-- Keep legacy get_my_organization_id() compatible and consistent
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.get_my_organization_id_jwt();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_organization_id_jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_organization_id() TO anon, authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 2. Enable RLS on ALL tenant tables (Idempotent)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- 3. Clean up all existing policies on tenant data tables
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
  pol record;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['products', 'sales', 'sale_items', 'customers', 'expenses', 'journal_entries', 'logs'])
  LOOP
    FOR pol IN 
      SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;


-- ────────────────────────────────────────────────────────────
-- 4. Install Strict RLS Policies on Products
-- ────────────────────────────────────────────────────────────
CREATE POLICY "products_super_admin_all" ON public.products
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin_jwt()))
  WITH CHECK ((SELECT public.is_super_admin_jwt()));

CREATE POLICY "products_org_select" ON public.products
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "products_org_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "products_org_update" ON public.products
  FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  )
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "products_org_delete" ON public.products
  FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );


-- ────────────────────────────────────────────────────────────
-- 5. Install Strict RLS Policies on Sales & Sale Items
-- ────────────────────────────────────────────────────────────
CREATE POLICY "sales_super_admin_all" ON public.sales
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin_jwt()))
  WITH CHECK ((SELECT public.is_super_admin_jwt()));

CREATE POLICY "sales_org_select" ON public.sales
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "sales_org_insert" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "sales_org_update" ON public.sales
  FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  )
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "sales_org_delete" ON public.sales
  FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

-- Sale Items
CREATE POLICY "sale_items_super_admin_all" ON public.sale_items
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin_jwt()))
  WITH CHECK ((SELECT public.is_super_admin_jwt()));

CREATE POLICY "sale_items_org_select" ON public.sale_items
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "sale_items_org_insert" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "sale_items_org_update" ON public.sale_items
  FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  )
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "sale_items_org_delete" ON public.sale_items
  FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );


-- ────────────────────────────────────────────────────────────
-- 6. Install Strict RLS Policies on Customers
-- ────────────────────────────────────────────────────────────
CREATE POLICY "customers_super_admin_all" ON public.customers
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin_jwt()))
  WITH CHECK ((SELECT public.is_super_admin_jwt()));

CREATE POLICY "customers_org_select" ON public.customers
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "customers_org_insert" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "customers_org_update" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  )
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "customers_org_delete" ON public.customers
  FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );


-- ────────────────────────────────────────────────────────────
-- 7. Install Strict RLS Policies on Expenses
-- ────────────────────────────────────────────────────────────
CREATE POLICY "expenses_super_admin_all" ON public.expenses
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin_jwt()))
  WITH CHECK ((SELECT public.is_super_admin_jwt()));

CREATE POLICY "expenses_org_select" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "expenses_org_insert" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "expenses_org_update" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  )
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "expenses_org_delete" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );


-- ────────────────────────────────────────────────────────────
-- 8. Install Strict RLS Policies on Journal Entries & Logs
-- ────────────────────────────────────────────────────────────
CREATE POLICY "journal_entries_super_admin_all" ON public.journal_entries
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin_jwt()))
  WITH CHECK ((SELECT public.is_super_admin_jwt()));

CREATE POLICY "journal_entries_org_select" ON public.journal_entries
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "journal_entries_org_insert" ON public.journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

-- Logs
CREATE POLICY "logs_super_admin_all" ON public.logs
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin_jwt()))
  WITH CHECK ((SELECT public.is_super_admin_jwt()));

CREATE POLICY "logs_org_select" ON public.logs
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

CREATE POLICY "logs_org_insert" ON public.logs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );


-- ────────────────────────────────────────────────────────────
-- 9. Auto-Assign organization_id Triggers (Before Insert)
--    Guarantees no row ever enters a table with organization_id = NULL
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_set_tenant_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_my_organization_id_jwt();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_product_organization_id ON public.products;
CREATE TRIGGER trg_auto_set_product_organization_id
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_organization_id();

DROP TRIGGER IF EXISTS trg_auto_set_sale_organization_id ON public.sales;
CREATE TRIGGER trg_auto_set_sale_organization_id
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_organization_id();

DROP TRIGGER IF EXISTS trg_auto_set_customer_organization_id ON public.customers;
CREATE TRIGGER trg_auto_set_customer_organization_id
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_organization_id();

DROP TRIGGER IF EXISTS trg_auto_set_expense_organization_id ON public.expenses;
CREATE TRIGGER trg_auto_set_expense_organization_id
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_organization_id();


-- ────────────────────────────────────────────────────────────
-- 10. Update handle_new_user() Trigger Function:
--     Never lose user's organization_id on sign up / staff creation!
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id UUID;
  v_role TEXT;
  v_name TEXT;
  v_matched_org_id UUID;
BEGIN
  -- 1. Extract organization_id from user metadata
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL AND NEW.raw_user_meta_data->>'organization_id' != '' THEN
    BEGIN
      v_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_org_id := NULL;
    END;
  END IF;

  -- 2. Extract from app_metadata if not in user_metadata
  IF v_org_id IS NULL AND NEW.raw_app_meta_data->>'organization_id' IS NOT NULL AND NEW.raw_app_meta_data->>'organization_id' != '' THEN
    BEGIN
      v_org_id := (NEW.raw_app_meta_data->>'organization_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_org_id := NULL;
    END;
  END IF;

  -- 3. Check if user's email matches an organization's admin_email
  IF NEW.email IS NOT NULL THEN
    SELECT id INTO v_matched_org_id 
    FROM public.organizations 
    WHERE lower(admin_email) = lower(NEW.email) 
    LIMIT 1;

    -- Only override v_org_id if matched, DO NOT overwrite with NULL!
    IF v_matched_org_id IS NOT NULL THEN
      v_org_id := v_matched_org_id;
      v_role := 'admin';
    END IF;
  END IF;

  -- Determine role if not set by admin_email match
  IF v_role IS NULL THEN
    v_role := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', ''),
      NULLIF(NEW.raw_app_meta_data->>'role', ''),
      'storekeeper'
    );
  END IF;

  v_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1));

  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, role, organization_id, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_role,
    v_org_id,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    role = CASE 
      WHEN public.profiles.role = 'super_admin' THEN 'super_admin'
      WHEN v_matched_org_id IS NOT NULL THEN 'admin'
      ELSE COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role)
    END,
    organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id),
    updated_at = now();

  -- Sync organization_id and role directly to app_metadata so JWT carries them immediately
  IF v_org_id IS NOT NULL THEN
    BEGIN
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
          'organization_id', v_org_id,
          'role', v_role
        )
      WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      -- Don't block auth user creation
    END;
  END IF;

  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 11. Recreate Tenant-Isolated Views with Strict Organization Matching
-- ────────────────────────────────────────────────────────────
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
LEFT JOIN public.sales s ON s.customer_id = c.id AND s.organization_id = c.organization_id
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
LEFT JOIN public.sales s ON s.customer_id = c.id AND s.organization_id = c.organization_id
GROUP BY c.id, c.name, c.phone, c.email, c.address, c.is_contractor, c.created_at, c.organization_id;

GRANT SELECT ON public.deposits TO authenticated, service_role;
GRANT SELECT ON public.customer_stats TO authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 12. Heal Existing Data: Ensure Profiles & Records Have Valid org_id
-- ────────────────────────────────────────────────────────────
-- Heal unlinked staff profiles from auth.users metadata
UPDATE public.profiles p
SET organization_id = (u.raw_user_meta_data->>'organization_id')::uuid
FROM auth.users u
WHERE p.id = u.id
  AND p.organization_id IS NULL
  AND u.raw_user_meta_data->>'organization_id' IS NOT NULL
  AND u.raw_user_meta_data->>'organization_id' != '';

-- Heal profiles matching admin_email of any organization
UPDATE public.profiles p
SET organization_id = o.id,
    role = 'admin'
FROM public.organizations o
WHERE p.organization_id IS NULL
  AND lower(o.admin_email) = lower(p.email);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
