-- Migration: 20260908_restore_and_protect_superadmin.sql
-- Purpose: Permanently restore and protect Super Admin (godwinokro2020@gmail.com)
--          and ensure they are never demoted to a store admin or restricted by multi-tenant RLS.

-- 1. Harden is_super_admin_jwt() to explicitly recognize godwinokro2020@gmail.com
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
    OR (LOWER(COALESCE((SELECT auth.jwt()->>'email'), '')) = 'godwinokro2020@gmail.com')
    OR ((SELECT auth.jwt()->'app_metadata'->>'role') = 'super_admin')
    OR ((SELECT auth.jwt()->'user_metadata'->>'role') = 'super_admin')
  );
$$;

-- 2. Harden is_super_admin()
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    public.is_super_admin_jwt()
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
  );
$$;

-- 3. Restore public.profiles for Godwin to super_admin and detach from any single tenant
UPDATE public.profiles
SET 
  role = 'super_admin',
  organization_id = NULL,
  updated_at = NOW()
WHERE LOWER(email) = 'godwinokro2020@gmail.com';

-- 4. Update auth.users metadata for Godwin to have super_admin role in JWT
UPDATE auth.users
SET 
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb,
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
WHERE LOWER(email) = 'godwinokro2020@gmail.com';

-- 5. Create a trigger on public.profiles to guarantee godwinokro2020@gmail.com is NEVER overwritten as non-super_admin
CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF LOWER(NEW.email) = 'godwinokro2020@gmail.com' THEN
    NEW.role := 'super_admin';
    NEW.organization_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin ON public.profiles;
CREATE TRIGGER trg_protect_super_admin
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_super_admin_profile();

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_super_admin_jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;
