-- ============================================================
-- Migration: 20260907_fix_user_profiles_and_org_association.sql
-- Fixes orphan user profiles, organization associations, and hardens
-- get_my_organization_id, is_super_admin, and record_pure_deposit.
-- ============================================================

-- 1. Ensure created_at and updated_at exist on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Harden is_super_admin (clean privilege check, no accidental anon elevation)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    current_user IN ('postgres', 'supabase_admin')
    OR (SELECT current_setting('request.jwt.claim.role', true)) = 'service_role'
    OR (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'super_admin'
    )
  );
$$;

-- 3. Resilient get_my_organization_id with automatic resolution & auto-linking
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
      -- Auto-heal / upsert profile record
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
      
      -- Auto-heal profile
      INSERT INTO public.profiles (id, email, full_name, role, organization_id, created_at, updated_at)
      VALUES (v_uid, COALESCE(v_email, ''), split_part(COALESCE(v_email, ''), '@', 1), 'admin', v_org_id, now(), now())
      ON CONFLICT (id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          updated_at = now();

      RETURN v_org_id;
    EXCEPTION WHEN OTHERS THEN
      -- invalid uuid in metadata, ignore
    END;
  END IF;

  RETURN NULL;
END;
$$;

-- 4. Canonical record_pure_deposit with fallback org resolution
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
    
    -- If get_my_organization_id is null, allow p_organization_id if user is org admin_email
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

  -- Create sale record for pure deposit (total_amount = 0, amount_paid = p_amount)
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

-- 5. Update handle_new_user trigger function to auto-link by admin_email
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
    BEGIN
      v_org_id := (NEW.raw_user_meta_data->>'organization_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_org_id := NULL;
    END;
  END IF;

  -- Check if user's email matches an organization's admin_email
  IF v_org_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT id INTO v_org_id 
    FROM public.organizations 
    WHERE lower(admin_email) = lower(NEW.email) 
    LIMIT 1;
  END IF;

  v_role := COALESCE(NEW.raw_user_meta_data->>'role', CASE WHEN v_org_id IS NOT NULL THEN 'admin' ELSE 'storekeeper' END);
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1));

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
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    organization_id = COALESCE(public.profiles.organization_id, EXCLUDED.organization_id),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 6. Backfill existing auth.users missing from public.profiles
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

-- 7. Link existing profiles with NULL organization_id where email matches organization admin_email
UPDATE public.profiles p
SET organization_id = o.id,
    role = CASE WHEN p.role = 'super_admin' THEN 'super_admin' ELSE 'admin' END,
    updated_at = now()
FROM public.organizations o
WHERE lower(p.email) = lower(o.admin_email)
  AND p.organization_id IS NULL;

-- 8. Grants
GRANT EXECUTE ON FUNCTION public.get_my_organization_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_pure_deposit(text, text, numeric, text, text, uuid) TO authenticated, service_role;

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
