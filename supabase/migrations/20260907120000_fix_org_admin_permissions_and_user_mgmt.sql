-- ============================================================
-- Migration: 20260907_fix_org_admin_permissions_and_user_mgmt.sql
-- Description:
-- 1. Fixes the PostgreSQL syntax error in sync_profile_to_app_metadata
--    (replaces invalid 'pg_catalog.coalesce' with native 'COALESCE').
-- 2. Hardens is_super_admin so anonymous users are NEVER treated as super admins.
-- 3. Creates resilient is_org_admin helper function checking JWT + profiles + organizations.
-- 4. Grants full Org Admin permissions on public.profiles:
--    - Org Admins can view all staff in their organization.
--    - Org Admins can update staff roles/names in their organization.
--    - Org Admins can insert staff profiles in their organization.
--    - Org Admins can delete staff profiles in their organization.
-- 5. Hardens public.log_action to auto-resolve organization_id.
-- 6. Adds admin_link_existing_user RPC so admins can seamlessly link
--    any pre-existing accounts to their organization.
-- 7. Adds admin_remove_staff RPC for secure staff deprovisioning and auditing.
-- ============================================================

-- 1. Fix sync_profile_to_app_metadata trigger function
CREATE OR REPLACE FUNCTION public.sync_profile_to_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Prevent recursion / deadlock
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Use standard SQL COALESCE (not pg_catalog.coalesce)
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'organization_id', NEW.organization_id,
      'role', NEW.role
    )
  WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never abort profile updates/inserts due to auth.users metadata sync errors
  RETURN NEW;
END;
$$;

-- 2. Harden is_super_admin (anonymous users are NEVER super admin)
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

-- 3. Create resilient is_org_admin helper function
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    public.is_super_admin()
    OR (
      (SELECT auth.jwt()->'app_metadata'->>'role') IN ('admin', 'super_admin')
      AND (SELECT auth.jwt()->'app_metadata'->>'organization_id') IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
        AND organization_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.organizations
      WHERE lower(admin_email) = lower((SELECT auth.jwt()->>'email'))
    )
  );
$$;

-- 4. Grant full Org Admin Row-Level Security policies on public.profiles
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Org members can read profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can update profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can insert profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Org admins can delete profiles in their org" ON public.profiles;

-- (a) Super Admins: full access
CREATE POLICY "Super admins can manage all profiles" ON public.profiles
  FOR ALL TO authenticated USING ((SELECT public.is_super_admin()));

-- (b) Users can read their own profile
CREATE POLICY "Users can read their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

-- (c) Org members can read all profiles in their organization
CREATE POLICY "Org members can read profiles in their org" ON public.profiles
  FOR SELECT TO authenticated USING (
    organization_id IS NOT NULL 
    AND organization_id = (SELECT public.get_my_organization_id())
  );

-- (d) Users can update their own profile (cannot escalate their own role)
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND (
      (SELECT public.is_org_admin())
      OR (
        role = (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
        AND organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
      )
    )
  );

-- (e) Org admins can update staff in their own organization (cannot edit super_admin)
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

-- (f) Users can insert their own profile
CREATE POLICY "Allow users to insert their own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- (g) Org admins can insert staff profiles into their own organization
CREATE POLICY "Org admins can insert profiles in their org" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_org_admin())
    AND organization_id = (SELECT public.get_my_organization_id())
    AND role IN ('admin', 'storekeeper', 'auditor')
  );

-- (h) Org admins can delete staff from their own organization (cannot delete themselves or super_admin)
CREATE POLICY "Org admins can delete profiles in their org" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    (SELECT public.is_org_admin())
    AND organization_id = (SELECT public.get_my_organization_id())
    AND id != (SELECT auth.uid())
    AND role != 'super_admin'
  );

-- 5. Harden log_action to ensure organization_id is never lost
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

-- 6. RPC: admin_link_existing_user
-- Allows an Org Admin to link an existing registered user to their organization
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

-- 7. RPC: admin_remove_staff
-- Safely removes a staff member, cleans auth metadata, and audits the deletion
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

  -- Remove profile
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- Clear app_metadata on auth.users so session token loses access
  BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data - 'organization_id' - 'role',
        raw_user_meta_data = raw_user_meta_data - 'organization_id' - 'role'
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- ignore
  END;

  -- Audit log
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

-- 8. Enable store owners to SELECT their organization even if unlinked in profiles
DROP POLICY IF EXISTS "Org members can view their own organization" ON public.organizations;
CREATE POLICY "Org members can view their own organization" ON public.organizations
  FOR SELECT TO authenticated USING (
    id = (SELECT public.get_my_organization_id())
    OR lower(admin_email) = lower((SELECT auth.jwt()->>'email'))
  );

-- 9. Trigger on public.products: Auto-populate organization_id if missing before insert
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

-- 10. Update handle_new_user trigger function to guarantee store owner gets 'admin' role
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
  v_is_admin_email BOOLEAN := FALSE;
BEGIN
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL AND NEW.raw_user_meta_data->>'organization_id' != '' THEN
    BEGIN
      v_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_org_id := NULL;
    END;
  END IF;

  -- Check if user's email matches an organization's admin_email
  IF NEW.email IS NOT NULL THEN
    SELECT id INTO v_org_id 
    FROM public.organizations 
    WHERE lower(admin_email) = lower(NEW.email) 
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
      v_is_admin_email := TRUE;
    END IF;
  END IF;

  IF v_is_admin_email THEN
    v_role := 'admin';
  ELSE
    v_role := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', ''),
      NULLIF(NEW.raw_app_meta_data->>'role', ''),
      CASE WHEN v_org_id IS NOT NULL THEN 'admin' ELSE 'storekeeper' END
    );
  END IF;

  v_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1));

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
      WHEN v_is_admin_email THEN 'admin'
      ELSE COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role)
    END,
    organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 11. Repair all existing profiles where email matches organization admin_email
UPDATE public.profiles p
SET role = 'admin',
    organization_id = o.id,
    updated_at = now()
FROM public.organizations o
WHERE lower(p.email) = lower(o.admin_email)
  AND p.role != 'super_admin';

-- 12. Permissions
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_profile_to_app_metadata() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_action(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_link_existing_user(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_set_product_organization_id() TO anon, authenticated, service_role;

-- 13. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
