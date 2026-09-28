-- ============================================================
-- Migration: 20260909_repair_multitenant_isolation.sql
-- 
-- PURPOSE: Fix critical RLS security leak where is_super_admin_jwt()
-- returned true for all callers due to SECURITY DEFINER current_user check.
-- Guarantee airtight multi-tenant data isolation across all businesses.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Correct is_super_admin_jwt()
--    CRITICAL: Never check current_user or session_user!
--    Evaluate ONLY the authenticated cryptographically signed JWT!
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin_jwt()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    -- Service role bypass
    (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
    OR (SELECT auth.role()) = 'service_role'
    -- Platform Super Admin email
    OR (LOWER(COALESCE((SELECT auth.jwt()->>'email'), '')) = 'godwinokro2020@gmail.com')
    -- Explicit super_admin roles in JWT claims
    OR ((SELECT auth.jwt()->'app_metadata'->>'role') = 'super_admin')
    OR ((SELECT auth.jwt()->'user_metadata'->>'role') = 'super_admin')
  ), false);
$$;

-- ────────────────────────────────────────────────────────────
-- 2. Correct is_super_admin()
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    public.is_super_admin_jwt()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
  ), false);
$$;

-- ────────────────────────────────────────────────────────────
-- 3. Hardened get_my_organization_id_jwt()
--    Super Admins MUST evaluate to NULL so they are never pinned
--    to any single tenant organization!
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_organization_id_jwt()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE 
    -- Super Admin has no single tenant lock
    WHEN public.is_super_admin_jwt() THEN NULL
    ELSE COALESCE(
      -- Priority 1: JWT app_metadata
      (SELECT (auth.jwt()->'app_metadata'->>'organization_id')::uuid),
      -- Priority 2: JWT user_metadata
      (SELECT (auth.jwt()->'user_metadata'->>'organization_id')::uuid),
      -- Priority 3: Check if email is an organization admin_email (exclude super admin)
      (SELECT id FROM public.organizations 
       WHERE lower(admin_email) = lower((SELECT auth.jwt()->>'email')) 
         AND lower(admin_email) != 'godwinokro2020@gmail.com' 
       LIMIT 1),
      -- Priority 4: Read from profiles
      (SELECT organization_id FROM public.profiles 
       WHERE id = (SELECT auth.uid()) AND role != 'super_admin')
    )
  END;
$$;

-- Keep get_my_organization_id() synchronized
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.get_my_organization_id_jwt();
$$;

-- ────────────────────────────────────────────────────────────
-- 4. Correct is_org_admin_jwt()
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_org_admin_jwt()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    public.is_super_admin_jwt()
    OR (
      (SELECT auth.jwt()->'app_metadata'->>'role') = 'admin'
      AND (SELECT auth.jwt()->'app_metadata'->>'organization_id') IS NOT NULL
    )
    OR (
      (SELECT auth.jwt()->'user_metadata'->>'role') = 'admin'
      AND (SELECT auth.jwt()->'user_metadata'->>'organization_id') IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.organizations
      WHERE lower(admin_email) = lower((SELECT auth.jwt()->>'email'))
        AND lower(admin_email) != 'godwinokro2020@gmail.com'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) 
        AND role = 'admin' 
        AND organization_id IS NOT NULL
    )
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_org_admin_jwt();
$$;

-- ────────────────────────────────────────────────────────────
-- 5. Disassociate Godwin's Super Admin email from Orca Deco admin_email
-- ────────────────────────────────────────────────────────────
UPDATE public.organizations
SET admin_email = 'orca@store.com'
WHERE id = '7ee09955-404a-446a-9db2-52127af0455a'
  AND lower(admin_email) = 'godwinokro2020@gmail.com';

-- Ensure Godwin's profile has role super_admin and organization_id NULL
UPDATE public.profiles
SET role = 'super_admin',
    organization_id = NULL,
    updated_at = NOW()
WHERE lower(email) = 'godwinokro2020@gmail.com';

-- Ensure Nana Ampadu admin profile has correct role and organization_id
UPDATE public.profiles
SET role = 'admin',
    organization_id = 'dec13f3c-585f-4ca7-a8ac-77f44e4f584b',
    updated_at = NOW()
WHERE lower(email) = 'nana@ampadu.com';

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.is_super_admin_jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_organization_id_jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_organization_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin_jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────
-- 6. Re-assert strict RLS policies across all tenant data tables
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

-- Products
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

-- Sales
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

-- Customers
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

-- Expenses
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

-- Journal Entries
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

-- Profiles RLS hardening
DROP POLICY IF EXISTS "profiles_super_admin_all" ON public.profiles;
CREATE POLICY "profiles_super_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin_jwt()))
  WITH CHECK ((SELECT public.is_super_admin_jwt()));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
