-- Migration: Auto-delete staff on organization deletion and cleanup orphaned profiles
-- Description: Ensures that when an organization is deleted, its staff accounts
-- (excluding super_admins) are automatically removed, avoiding orphaned accounts.

-- 1. Create trigger function to cascade delete staff profiles & clean auth users
CREATE OR REPLACE FUNCTION public.trg_cascade_delete_org_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_ids uuid[];
BEGIN
  -- Collect user IDs of all staff belonging to the deleted organization (excluding super_admins)
  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE organization_id = OLD.id
    AND role != 'super_admin';

  -- 1. Delete associated profile rows
  DELETE FROM public.profiles
  WHERE organization_id = OLD.id
    AND role != 'super_admin';

  -- 2. Clean auth users / metadata if applicable
  IF v_user_ids IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = ANY(v_user_ids);
    EXCEPTION WHEN OTHERS THEN
      -- If foreign key or permission prevents direct deletion, strip tenancy metadata
      BEGIN
        UPDATE auth.users
        SET raw_app_meta_data = raw_app_meta_data - 'organization_id' - 'role',
            raw_user_meta_data = raw_user_meta_data - 'organization_id' - 'role'
        WHERE id = ANY(v_user_ids);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END IF;

  RETURN OLD;
END;
$$;

-- 2. Bind trigger BEFORE DELETE on public.organizations
DROP TRIGGER IF EXISTS trg_cascade_delete_org_staff ON public.organizations;
CREATE TRIGGER trg_cascade_delete_org_staff
  BEFORE DELETE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_cascade_delete_org_staff();

-- 3. One-time cleanup for existing orphaned staff profiles (from previously deleted stores)
DO $$
DECLARE
  v_orphaned_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_orphaned_ids
  FROM public.profiles
  WHERE organization_id IS NULL
    AND role != 'super_admin';

  IF v_orphaned_ids IS NOT NULL THEN
    DELETE FROM public.profiles
    WHERE id = ANY(v_orphaned_ids);

    BEGIN
      DELETE FROM auth.users WHERE id = ANY(v_orphaned_ids);
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        UPDATE auth.users
        SET raw_app_meta_data = raw_app_meta_data - 'organization_id' - 'role',
            raw_user_meta_data = raw_user_meta_data - 'organization_id' - 'role'
        WHERE id = ANY(v_orphaned_ids);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END IF;
END $$;
