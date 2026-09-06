-- Migration: 20260906_fix_profile_triggers_and_created_at.sql
-- Fixes trigger recursion/deadlock during user signup and adds missing created_at to profiles.

-- 1. Add created_at column to public.profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

-- 2. Drop the recursive trigger on public.profiles that was firing on INSERT
DROP TRIGGER IF EXISTS on_profile_updated_sync_app_metadata ON public.profiles;

-- 3. Update sync_profile_to_app_metadata with guard against recursion / in-flight insert locks
CREATE OR REPLACE FUNCTION public.sync_profile_to_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Prevent deadlock / tuple concurrency lock when called within auth.users transaction
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

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

-- 4. Recreate trigger on profiles ONLY for UPDATE of organization_id or role (never on INSERT)
CREATE TRIGGER on_profile_updated_sync_app_metadata
  AFTER UPDATE OF organization_id, role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_app_metadata();

-- 5. Update handle_new_user to populate profiles cleanly and handle conflicts
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
BEGIN
  IF NEW.raw_user_meta_data->>'organization_id' IS NOT NULL AND NEW.raw_user_meta_data->>'organization_id' != '' THEN
    v_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
  END IF;

  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'storekeeper');
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

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
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
