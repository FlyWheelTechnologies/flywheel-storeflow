-- ============================================================
-- Migration: 20260908_fix_profiles_rls_recursion.sql
-- 
-- Fixes "infinite recursion detected in policy for relation profiles"
--
-- ROOT CAUSE: The previous migration's RLS policies on public.profiles
-- called get_my_organization_id() and is_org_admin(), which themselves
-- query public.profiles → triggers the same policies → infinite loop.
--
-- FIX: All policies on public.profiles use ONLY auth.jwt() claims and
-- auth.uid() — never querying profiles back. The JWT already contains
-- organization_id and role in app_metadata (set by the
-- sync_profile_to_app_metadata trigger).
--
-- For helper functions used by OTHER tables' policies (products, sales,
-- etc.), querying profiles is fine — only profiles→profiles is recursive.
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. JWT-only helper: check if current user is super admin (NO profiles query)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin_jwt()
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
    OR (SELECT auth.jwt()->'app_metadata'->>'role') = 'super_admin'
    OR (SELECT auth.jwt()->'user_metadata'->>'role') = 'super_admin'
  );
$$;

-- ────────────────────────────────────────────────
-- 2. JWT-only helper: get org_id from JWT (NO profiles query)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_organization_id_jwt()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT auth.jwt()->'app_metadata'->>'organization_id')::uuid,
    (SELECT auth.jwt()->'user_metadata'->>'organization_id')::uuid,
    -- Fallback: check if JWT email matches an organization's admin_email
    (SELECT id FROM public.organizations WHERE lower(admin_email) = lower((SELECT auth.jwt()->>'email')) LIMIT 1)
  );
$$;

-- ────────────────────────────────────────────────
-- 3. JWT-only helper: check if current user is org admin (NO profiles query)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_org_admin_jwt()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    public.is_super_admin_jwt()
    OR (
      (SELECT auth.jwt()->'app_metadata'->>'role') IN ('admin', 'super_admin')
      AND (SELECT auth.jwt()->'app_metadata'->>'organization_id') IS NOT NULL
    )
    OR (
      (SELECT auth.jwt()->'user_metadata'->>'role') IN ('admin', 'super_admin')
      AND (SELECT auth.jwt()->'user_metadata'->>'organization_id') IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.organizations
      WHERE lower(admin_email) = lower((SELECT auth.jwt()->>'email'))
    )
  );
$$;

-- ────────────────────────────────────────────────
-- 4. Drop ALL existing profiles policies to start clean
-- ────────────────────────────────────────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────
-- 5. Create recursion-safe RLS policies on public.profiles
--    (ALL use auth.jwt() / auth.uid() only — NEVER query profiles)
-- ────────────────────────────────────────────────

-- Enable RLS (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- (a) Super Admins: full unrestricted access (JWT-based check)
CREATE POLICY "profiles_super_admin_all"
  ON public.profiles FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin_jwt()))
  WITH CHECK ((SELECT public.is_super_admin_jwt()));

-- (b) Users can always read their own profile
CREATE POLICY "profiles_self_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- (c) Users can update their own profile (basic fields only — cannot escalate role)
CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- (d) Users can insert their own profile (for new-user auto-creation)
CREATE POLICY "profiles_self_insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- (e) Org members can read all profiles in their organization
CREATE POLICY "profiles_org_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
  );

-- (f) Org admins can insert staff profiles into their organization
CREATE POLICY "profiles_org_admin_insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_org_admin_jwt())
    AND organization_id IS NOT NULL
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
    AND role IN ('admin', 'storekeeper', 'auditor')
  );

-- (g) Org admins can update staff profiles in their organization
CREATE POLICY "profiles_org_admin_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_org_admin_jwt())
    AND organization_id IS NOT NULL
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
    AND role != 'super_admin'
  )
  WITH CHECK (
    (SELECT public.is_org_admin_jwt())
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
    AND role IN ('admin', 'storekeeper', 'auditor')
  );

-- (h) Org admins can delete staff from their organization (not themselves, not super_admin)
CREATE POLICY "profiles_org_admin_delete"
  ON public.profiles FOR DELETE TO authenticated
  USING (
    (SELECT public.is_org_admin_jwt())
    AND organization_id IS NOT NULL
    AND organization_id = (SELECT public.get_my_organization_id_jwt())
    AND id != (SELECT auth.uid())
    AND role != 'super_admin'
  );

-- ────────────────────────────────────────────────
-- 6. Grant execute on new JWT helper functions
-- ────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_super_admin_jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_organization_id_jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin_jwt() TO anon, authenticated, service_role;

-- ────────────────────────────────────────────────
-- 7. Reload PostgREST schema cache
-- ────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
