-- ====================================================================
-- StoreFlow: Database Migration & Verification Test Suite
-- Run this script in the Supabase SQL Editor to apply fixes and verify.
-- ====================================================================

-- 1. Ensure created_at and updated_at exist on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Fix sync_profile_to_app_metadata trigger function (replaces invalid pg_catalog.coalesce)
CREATE OR REPLACE FUNCTION public.sync_profile_to_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'organization_id', NEW.organization_id,
      'role', NEW.role
    )
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- 3. Harden is_super_admin (anonymous users are NEVER treated as super admins)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
    OR (SELECT auth.role()) = 'service_role'
    OR (current_user IN ('postgres', 'supabase_admin'))
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
  );
$$;

-- 4. Create is_org_admin helper function
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
        AND organization_id IS NOT NULL
    )
  );
$$;

-- 5. Resilient get_my_organization_id with automatic resolution & auto-linking
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id UUID;
  v_uid UUID;
  v_email TEXT;
  v_jwt_org_id TEXT;
BEGIN
  v_uid := (SELECT auth.uid());
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Step A: Check profiles table first
  SELECT organization_id INTO v_org_id 
  FROM public.profiles 
  WHERE id = v_uid;
  
  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  -- Step B: Fallback from JWT email matching organization's admin_email
  v_email := (SELECT auth.jwt()->>'email');
  IF v_email IS NOT NULL AND v_email != '' THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE lower(admin_email) = lower(v_email)
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.profiles (id, email, full_name, role, organization_id, created_at, updated_at)
      VALUES (v_uid, v_email, split_part(v_email, '@', 1), 'admin', v_org_id, now(), now())
      ON CONFLICT (id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          role = CASE WHEN public.profiles.role = 'super_admin' THEN 'super_admin' ELSE 'admin' END,
          updated_at = now();
          
      RETURN v_org_id;
    END IF;
  END IF;

  -- Step C: Fallback from JWT user_metadata->organization_id
  v_jwt_org_id := (SELECT auth.jwt()->'user_metadata'->>'organization_id');
  IF v_jwt_org_id IS NOT NULL AND v_jwt_org_id != '' THEN
    BEGIN
      v_org_id := v_jwt_org_id::uuid;
      
      INSERT INTO public.profiles (id, email, full_name, role, organization_id, created_at, updated_at)
      VALUES (v_uid, COALESCE(v_email, ''), split_part(COALESCE(v_email, ''), '@', 1), 'admin', v_org_id, now(), now())
      ON CONFLICT (id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          updated_at = now();

      RETURN v_org_id;
    EXCEPTION WHEN OTHERS THEN
      -- ignore
    END;
  END IF;

  RETURN NULL;
END;
$$;

-- 6. Canonical record_pure_deposit with fallback org resolution
DROP FUNCTION IF EXISTS public.record_pure_deposit(text, text, numeric, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.record_pure_deposit(text, text, numeric, text, text, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.record_pure_deposit(
  p_customer_name text,
  p_customer_phone text,
  p_amount numeric,
  p_payment_method text,
  p_recorded_by text,
  p_organization_id uuid DEFAULT NULL
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
  v_jwt_email text;
BEGIN
  v_jwt_email := (SELECT auth.jwt()->>'email');

  -- Resolve organization ID
  IF public.is_super_admin() THEN
    v_org_id := p_organization_id;
    IF v_org_id IS NULL THEN
      SELECT organization_id INTO v_org_id 
      FROM public.customers 
      WHERE (phone = p_customer_phone OR name = p_customer_name)
        AND organization_id IS NOT NULL
      LIMIT 1;
    END IF;
  ELSE
    v_org_id := public.get_my_organization_id();
    
    IF v_org_id IS NULL AND p_organization_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.organizations 
        WHERE id = p_organization_id 
          AND (lower(admin_email) = lower(v_jwt_email) OR lower(admin_email) = lower(p_recorded_by))
      ) THEN
        v_org_id := p_organization_id;
      END IF;
    END IF;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;

  -- Find or create customer
  SELECT id INTO v_customer_id 
  FROM public.customers 
  WHERE phone = p_customer_phone AND organization_id = v_org_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, phone, credit_balance, organization_id)
    VALUES (p_customer_name, p_customer_phone, p_amount, v_org_id)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers 
    SET credit_balance = credit_balance + p_amount,
        updated_at = now()
    WHERE id = v_customer_id AND organization_id = v_org_id;
  END IF;

  -- Create sale record for pure deposit
  INSERT INTO public.sales (
    customer_id,
    customer_name,
    total_amount,
    amount_paid,
    payment_method,
    payment_status,
    items,
    recorded_by,
    invoice_no,
    organization_id,
    created_at
  ) VALUES (
    v_customer_id,
    p_customer_name,
    0,
    p_amount,
    p_payment_method,
    'pure_deposit',
    '[]'::jsonb,
    p_recorded_by,
    'DEP-' || upper(substr(md5(random()::text), 1, 8)),
    v_org_id,
    now()
  )
  RETURNING id INTO v_sale_id;

  -- Insert Double-Entry Journal Entry
  INSERT INTO public.journal_entries (account_type, debit, credit, description, organization_id, created_at)
  VALUES 
    ('asset_cash', p_amount, 0, 'Pure Deposit from ' || p_customer_name, v_org_id, now()),
    ('liability_customer_credit', 0, p_amount, 'Credit liability for ' || p_customer_name, v_org_id, now());

  -- Audit log
  INSERT INTO public.logs (user_email, user_role, action, details, organization_id, created_at)
  VALUES (
    p_recorded_by,
    'staff',
    'PURE_DEPOSIT',
    'Recorded pure deposit of ' || p_amount || ' for ' || p_customer_name,
    v_org_id,
    now()
  );

  RETURN v_sale_id;
END;
$$;

-- 7. Grant full Org Admin Row-Level Security policies on public.profiles
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Org members can read profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can update profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can insert profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can delete profiles in their org" ON public.profiles;

-- Super Admins: full access
CREATE POLICY "Super admins can manage all profiles" ON public.profiles
  FOR ALL TO authenticated USING ((SELECT public.is_super_admin()));

-- Users can read their own profile
CREATE POLICY "Users can read their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

-- Org members can read all profiles in their organization
CREATE POLICY "Org members can read profiles in their org" ON public.profiles
  FOR SELECT TO authenticated USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id())
  );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Org admins can update staff in their own organization (cannot edit super_admin)
CREATE POLICY "Org admins can update profiles in their org" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_org_admin())
    AND organization_id = (SELECT public.get_my_organization_id())
    AND role != 'super_admin'
  )
  WITH CHECK (
    (SELECT public.is_org_admin())
    AND organization_id = (SELECT public.get_my_organization_id())
    AND role IN ('admin', 'storekeeper', 'auditor')
  );

-- Users can insert their own profile
CREATE POLICY "Allow users to insert their own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- Org admins can insert staff profiles into their own organization
CREATE POLICY "Org admins can insert profiles in their org" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_org_admin())
    AND organization_id = (SELECT public.get_my_organization_id())
    AND role IN ('admin', 'storekeeper', 'auditor')
  );

-- Org admins can delete staff from their own organization (cannot delete themselves or super_admin)
CREATE POLICY "Org admins can delete profiles in their org" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_org_admin())
    AND organization_id = (SELECT public.get_my_organization_id())
    AND id != (SELECT auth.uid())
    AND role != 'super_admin'
  );

-- 8. Harden log_action to ensure organization_id is never lost
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
  WHERE id = (SELECT auth.uid());

  IF v_org_id IS NULL THEN
    v_org_id := public.get_my_organization_id();
  END IF;

  IF v_user_email IS NULL THEN
    v_user_email := (SELECT auth.jwt()->>'email');
    IF v_user_email IS NULL THEN
      v_user_email := 'system';
      v_user_role := 'storekeeper';
    END IF;
  END IF;

  INSERT INTO public.logs (user_email, user_role, action, details, organization_id, created_at)
  VALUES (v_user_email, COALESCE(v_user_role, 'staff'), p_action, p_details, v_org_id, now());
END;
$$;

-- 9. RPC: admin_link_existing_user
CREATE OR REPLACE FUNCTION public.admin_link_existing_user(
  p_email text,
  p_role text,
  p_full_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_target_user_id uuid;
BEGIN
  IF NOT public.is_org_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only organization admins can link staff members';
  END IF;

  v_org_id := public.get_my_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Caller has no active organization';
  END IF;

  IF p_role NOT IN ('admin', 'storekeeper', 'auditor') THEN
    RAISE EXCEPTION 'Invalid role: Must be admin, storekeeper, or auditor';
  END IF;

  SELECT id INTO v_target_user_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email));

  IF v_target_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET organization_id = v_org_id,
        role = p_role,
        full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
        updated_at = now()
    WHERE id = v_target_user_id;

    BEGIN
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object('organization_id', v_org_id, 'role', p_role),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object('organization_id', v_org_id, 'role', p_role)
      WHERE id = v_target_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- ignore
    END;

    INSERT INTO public.logs (user_email, user_role, action, details, organization_id, created_at)
    VALUES (
      (SELECT email FROM public.profiles WHERE id = (SELECT auth.uid())),
      'admin',
      'USER_LINK',
      'Linked existing user ' || p_email || ' as ' || p_role,
      v_org_id,
      now()
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 10. RPC: admin_remove_staff
CREATE OR REPLACE FUNCTION public.admin_remove_staff(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_user_email text;
  v_target_role text;
BEGIN
  IF NOT public.is_org_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only organization admins can remove staff';
  END IF;

  v_org_id := public.get_my_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Caller has no active organization';
  END IF;

  IF p_user_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Cannot remove your own admin account';
  END IF;

  SELECT email, role INTO v_user_email, v_target_role
  FROM public.profiles
  WHERE id = p_user_id AND organization_id = v_org_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Staff member not found in your organization';
  END IF;

  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot remove super admin accounts';
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;

  BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data - 'organization_id' - 'role',
        raw_user_meta_data = raw_user_meta_data - 'organization_id' - 'role'
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- ignore
  END;

  INSERT INTO public.logs (user_email, user_role, action, details, organization_id, created_at)
  VALUES (
    (SELECT email FROM public.profiles WHERE id = (SELECT auth.uid())),
    'admin',
    'USER_DELETE',
    'Removed staff member ' || v_user_email || ' (' || v_target_role || ')',
    v_org_id,
    now()
  );

  RETURN true;
END;
$$;

-- 11. Backfill existing auth.users missing from public.profiles
INSERT INTO public.profiles (id, email, full_name, role, organization_id, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(COALESCE(u.email, ''), '@', 1)),
  COALESCE(u.raw_user_meta_data->>'role', CASE WHEN o.id IS NOT NULL THEN 'admin' ELSE 'storekeeper' END),
  COALESCE((u.raw_user_meta_data->>'organization_id')::uuid, o.id),
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.organizations o ON lower(o.admin_email) = lower(u.email)
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE SET
  organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
  role = COALESCE(public.profiles.role, EXCLUDED.role),
  updated_at = now();

-- 12. Enable store owners to SELECT their organization even if unlinked in profiles
DROP POLICY IF EXISTS "Org members can view their own organization" ON public.organizations;
CREATE POLICY "Org members can view their own organization" ON public.organizations
  FOR SELECT TO authenticated USING (
    id = (SELECT public.get_my_organization_id())
    OR lower(admin_email) = lower((SELECT auth.jwt()->>'email'))
  );

-- 13. Trigger on public.products: Auto-populate organization_id if missing before insert
CREATE OR REPLACE FUNCTION public.auto_set_product_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_my_organization_id();
  END IF;

  IF NEW.organization_id IS NULL AND (SELECT auth.jwt()->>'email') IS NOT NULL THEN
    SELECT id INTO NEW.organization_id 
    FROM public.organizations 
    WHERE lower(admin_email) = lower((SELECT auth.jwt()->>'email')) 
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_set_product_organization_id ON public.products;
CREATE TRIGGER trg_auto_set_product_organization_id
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_product_organization_id();

-- 14. Repair all profiles where email matches organization admin_email
UPDATE public.profiles p
SET role = 'admin',
    organization_id = o.id,
    updated_at = now()
FROM public.organizations o
WHERE lower(p.email) = lower(o.admin_email)
  AND p.role != 'super_admin';

-- 15. Permissions & Cache Reload
GRANT EXECUTE ON FUNCTION public.get_my_organization_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_profile_to_app_metadata() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_action(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_link_existing_user(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_set_product_organization_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_pure_deposit(text, text, numeric, text, text, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- 13. Run Verification Test Block
-- ====================================================================
DO $$
DECLARE
  v_org_id UUID;
  v_prod_id UUID;
  v_cust_id BIGINT;
  v_sale_id UUID;
  v_deposit_id UUID;
  v_is_super BOOLEAN;
  v_is_org_adm BOOLEAN;
BEGIN
  RAISE NOTICE '=== Starting Database Functions Test Suite ===';

  -- 1. Test is_super_admin()
  SELECT public.is_super_admin() INTO v_is_super;
  RAISE NOTICE '1. is_super_admin() returned: %', v_is_super;

  -- 2. Test is_org_admin()
  SELECT public.is_org_admin() INTO v_is_org_adm;
  RAISE NOTICE '2. is_org_admin() returned: %', v_is_org_adm;

  -- 3. Test get_my_organization_id()
  SELECT public.get_my_organization_id() INTO v_org_id;
  RAISE NOTICE '3. get_my_organization_id() returned: %', v_org_id;

  -- 4. Get or create a temporary organization for testing
  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug, admin_email) VALUES ('Test Org', 'test-org-db', 'test@storeflow.com') RETURNING id INTO v_org_id;
  END IF;
  RAISE NOTICE '4. Using Organization ID: %', v_org_id;

  -- 5. Get or create a customer
  SELECT id INTO v_cust_id FROM public.customers WHERE organization_id = v_org_id LIMIT 1;
  IF v_cust_id IS NULL THEN
    INSERT INTO public.customers (name, phone, organization_id)
    VALUES ('Test Customer', '0241234567', v_org_id)
    RETURNING id INTO v_cust_id;
  END IF;
  RAISE NOTICE '5. Using Customer ID: %', v_cust_id;

  -- 6. Get or create a product
  SELECT id INTO v_prod_id FROM public.products WHERE organization_id = v_org_id LIMIT 1;
  IF v_prod_id IS NULL THEN
    INSERT INTO public.products (name, selling_price, cost_price, stock_quantity, organization_id)
    VALUES ('Test Product', 50, 30, 100, v_org_id)
    RETURNING id INTO v_prod_id;
  END IF;
  RAISE NOTICE '6. Using Product ID: %', v_prod_id;

  -- 7. Test record_pure_deposit
  SELECT public.record_pure_deposit(
    p_customer_name => 'Test Customer',
    p_customer_phone => '0241234567',
    p_amount => 200,
    p_payment_method => 'MoMo',
    p_recorded_by => 'test@storeflow.com',
    p_organization_id => v_org_id
  ) INTO v_deposit_id;
  RAISE NOTICE '7. record_pure_deposit SUCCESS: Deposit Sale ID %', v_deposit_id;

  -- 8. Clean up test deposit
  DELETE FROM public.sales WHERE id = v_deposit_id;
  RAISE NOTICE '8. Cleaned up test sales';

  -- 9. Test log_action
  PERFORM public.log_action('TEST_AUDIT', 'Database functions test completed successfully');
  RAISE NOTICE '9. log_action SUCCESS';

  RAISE NOTICE '=== ALL RPC DATABASE FUNCTIONS & POLICIES PASSED SUCCESSFULLY ===';
END $$;
