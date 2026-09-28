-- Migration: 20260906_harden_rpc_super_admin_and_tests.sql
-- Purpose: Harden is_super_admin to recognize service_role and direct maintenance connections.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    (SELECT auth.uid()) IS NULL
    OR (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
    OR (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
  );
$$;

NOTIFY pgrst, 'reload schema';
