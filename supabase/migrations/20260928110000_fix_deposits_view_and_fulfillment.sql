-- ============================================================
-- Migration: 20260928_fix_deposits_view_and_fulfillment.sql
-- 1. Ensure credit_balance column exists on public.customers
-- 2. Backfill missing organization_ids on sales, items & journal entries
-- 3. Deduplicate duplicate customers (e.g. Prince) & add unique index
-- 4. FIFO customer credit deduction on sales (record_sale_transaction)
-- 5. Enhanced record_pure_deposit with customer lookup & selection support
-- 6. Add delete_customer_cascade function for full admin customer deletion
-- 7. Recreate deposits view with support for all pending order types
-- 8. Reconcile historical credit usage and sync customer credit_balances
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: Add credit_balance column to public.customers if missing
-- ------------------------------------------------------------
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS credit_balance numeric DEFAULT 0;

-- ------------------------------------------------------------
-- STEP 2: Backfill missing organization_id on sales & related tables
-- ------------------------------------------------------------
UPDATE public.sales s
SET organization_id = c.organization_id
FROM public.customers c
WHERE s.customer_id = c.id
  AND s.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

UPDATE public.sale_items si
SET organization_id = s.organization_id
FROM public.sales s
WHERE si.sale_id = s.id
  AND si.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

UPDATE public.journal_entries j
SET organization_id = s.organization_id
FROM public.sales s
WHERE j.sale_id = s.id
  AND j.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

-- ------------------------------------------------------------
-- STEP 3: Merge and Deduplicate existing duplicate customers
-- ------------------------------------------------------------
DO $$
DECLARE
  v_dup RECORD;
  v_primary_id BIGINT;
BEGIN
  -- 1. Deduplicate by organization_id and phone (when phone is valid and not generic)
  FOR v_dup IN (
    SELECT organization_id, phone, ARRAY_AGG(id ORDER BY id ASC) AS ids
    FROM public.customers
    WHERE phone IS NOT NULL AND phone NOT IN ('', '+233')
    GROUP BY organization_id, phone
    HAVING COUNT(*) > 1
  ) LOOP
    v_primary_id := v_dup.ids[1];

    -- Reassign sales to primary customer
    UPDATE public.sales
    SET customer_id = v_primary_id
    WHERE customer_id = ANY(v_dup.ids[2:]);

    -- Delete duplicate customer rows
    DELETE FROM public.customers
    WHERE id = ANY(v_dup.ids[2:]);
  END LOOP;

  -- 2. Deduplicate by organization_id and normalized name (for remaining duplicates without unique phone)
  FOR v_dup IN (
    SELECT organization_id, LOWER(TRIM(name)) AS norm_name, ARRAY_AGG(id ORDER BY id ASC) AS ids
    FROM public.customers
    GROUP BY organization_id, LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  ) LOOP
    v_primary_id := v_dup.ids[1];

    -- Reassign sales to primary customer
    UPDATE public.sales
    SET customer_id = v_primary_id
    WHERE customer_id = ANY(v_dup.ids[2:]);

    -- Delete duplicate customer rows
    DELETE FROM public.customers
    WHERE id = ANY(v_dup.ids[2:]);
  END LOOP;
END $$;

-- Add partial unique index to prevent future phone duplicates within the same organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_phone 
ON public.customers (organization_id, phone) 
WHERE phone IS NOT NULL AND phone != '' AND phone != '+233';

-- ------------------------------------------------------------
-- STEP 4: Drop competing overloads of record_sale_transaction
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_sale_transaction(text, numeric, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(uuid, text, numeric, numeric, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(bigint, text, numeric, numeric, text, text, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric, timestamptz, text) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric, timestamptz, text, uuid) CASCADE;

-- ------------------------------------------------------------
-- STEP 5: Recreate record_sale_transaction with FIFO credit deduction & safe credit_balance update
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_sale_transaction(
  p_customer_id integer,
  p_customer_name text, 
  p_total_amount numeric,
  p_amount_paid numeric, 
  p_payment_method text, 
  p_payment_status text,
  p_items jsonb,
  p_recorded_by text,
  p_tax_percentage numeric DEFAULT 0,
  p_tax_inclusive boolean DEFAULT TRUE,
  p_credit_used numeric DEFAULT 0,
  p_created_at timestamptz DEFAULT NULL,
  p_invoice_no text DEFAULT NULL,
  p_organization_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_sale_id UUID;
  v_tax_amount NUMERIC := 0;
  v_net_amount NUMERIC := 0;
  v_total_with_tax NUMERIC;
  v_item RECORD;
  v_org_id UUID;
  v_max_seq INTEGER;
  v_rem_credit NUMERIC := COALESCE(p_credit_used, 0);
  v_dep_record RECORD;
  v_deduct NUMERIC := 0;
BEGIN
  -- 1. Identify caller's organization (with Super Admin impersonation support)
  IF public.is_super_admin() THEN
    v_org_id := p_organization_id;
    IF v_org_id IS NULL THEN
      SELECT organization_id INTO v_org_id 
      FROM public.products 
      WHERE id = (
        SELECT product_id 
        FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC) 
        LIMIT 1
      );
    END IF;
    IF v_org_id IS NULL AND p_customer_id IS NOT NULL THEN
      SELECT organization_id INTO v_org_id FROM public.customers WHERE id = p_customer_id;
    END IF;
  ELSE
    v_org_id := public.get_my_organization_id();
    IF v_org_id IS NULL AND p_organization_id IS NOT NULL THEN
      v_org_id := p_organization_id;
    END IF;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;

  -- 2. Tenant-scoped invoice sequencing
  IF p_invoice_no IS NULL THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_no, '^INV-', ''), '')::integer), 0)
    INTO v_max_seq
    FROM public.sales
    WHERE invoice_no ~ '^INV-[0-9]+$'
      AND organization_id = v_org_id;
      
    p_invoice_no := 'INV-' || pg_catalog.lpad((v_max_seq + 1)::text, 3, '0');
  END IF;

  -- 3. Compute tax and net figures
  IF p_tax_inclusive THEN
    v_net_amount := ROUND(p_total_amount / (1 + (p_tax_percentage / 100)), 2);
    v_tax_amount := ROUND(p_total_amount - v_net_amount, 2);
    v_total_with_tax := ROUND(p_total_amount, 2);
  ELSE
    v_tax_amount := ROUND(p_total_amount * (p_tax_percentage / 100), 2);
    v_net_amount := ROUND(p_total_amount, 2);
    v_total_with_tax := ROUND(p_total_amount + v_tax_amount, 2);
  END IF;

  -- 4. Insert Sale Record with organization_id
  INSERT INTO public.sales (
    customer_id, customer_name, total_amount, amount_paid, 
    balance_due, payment_status, payment_method, recorded_by,
    tax_percentage, tax_inclusive, tax_amount, created_at, invoice_no, organization_id
  )
  VALUES (
    p_customer_id, p_customer_name, 
    v_total_with_tax, 
    ROUND(p_amount_paid + COALESCE(p_credit_used, 0), 2),
    ROUND(v_total_with_tax - (p_amount_paid + COALESCE(p_credit_used, 0)), 2),
    UPPER(p_payment_status), p_payment_method, p_recorded_by,
    p_tax_percentage, p_tax_inclusive, v_tax_amount,
    COALESCE(p_created_at, pg_catalog.now()),
    p_invoice_no,
    v_org_id
  ) RETURNING id INTO v_sale_id;

  -- 5. Insert Sale Items and deduct stock strictly scoped to this organization
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal, organization_id)
    VALUES (v_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, ROUND(v_item.subtotal, 2), v_org_id);
    
    UPDATE public.products 
    SET stock_quantity = stock_quantity - v_item.quantity 
    WHERE id = v_item.product_id AND organization_id = v_org_id;
  END LOOP;

  -- 6. Accounting Journal Entries with organization_id
  INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at, organization_id) 
  VALUES (v_sale_id, 'REVENUE', v_net_amount, 'Revenue from Sale #' || v_sale_id, COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  
  IF v_tax_amount > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'TAX_PAYABLE', v_tax_amount, 'Tax collected', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;
  
  IF p_amount_paid > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, pg_catalog.upper(p_payment_method), ROUND(p_amount_paid, 2), 'Payment received', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;

  IF COALESCE(p_credit_used, 0) > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'CUSTOMER_DEPOSIT', ROUND(p_credit_used, 2), 'Applied from customer credit', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;
  
  IF (v_total_with_tax - (p_amount_paid + COALESCE(p_credit_used, 0))) > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'ACCOUNTS_RECEIVABLE', ROUND(v_total_with_tax - (p_amount_paid + COALESCE(p_credit_used, 0)), 2), 'Debt recorded', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;

  -- 7. Deduct credit from existing customer deposit records (FIFO order)
  IF v_rem_credit > 0 AND p_customer_id IS NOT NULL THEN
    FOR v_dep_record IN (
      SELECT id, balance_due, notes 
      FROM public.sales 
      WHERE customer_id = p_customer_id 
        AND (organization_id = v_org_id OR organization_id IS NULL)
        AND balance_due < 0
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    ) LOOP
      EXIT WHEN v_rem_credit <= 0;

      v_deduct := LEAST(ABS(v_dep_record.balance_due), v_rem_credit);

      -- If deposit is fully consumed, mark it fulfilled in notes and clear balance_due
      IF (v_dep_record.balance_due + v_deduct) >= 0 THEN
        UPDATE public.sales
        SET balance_due = 0,
            notes = CASE 
              WHEN notes IS NULL OR notes = '' THEN '(Fulfilled - Credit Consumed)'
              WHEN notes ILIKE '%(Fulfilled)%' THEN notes
              ELSE notes || ' | (Fulfilled - Credit Consumed)'
            END
        WHERE id = v_dep_record.id;
      ELSE
        UPDATE public.sales
        SET balance_due = balance_due + v_deduct
        WHERE id = v_dep_record.id;
      END IF;

      v_rem_credit := v_rem_credit - v_deduct;
    END LOOP;

    -- Update customer credit balance column safely
    UPDATE public.customers
    SET credit_balance = (
      SELECT COALESCE(ABS(SUM(balance_due)), 0)
      FROM public.sales
      WHERE customer_id = p_customer_id
        AND balance_due < 0
        AND (notes IS NULL OR notes NOT ILIKE '%(Fulfilled)%')
    )
    WHERE id = p_customer_id;
  END IF;

  RETURN v_sale_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_sale_transaction(
  integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric, timestamptz, text, uuid
) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- STEP 6: Enhanced record_pure_deposit supporting customer selection and deduplication
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_pure_deposit(text, text, numeric, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.record_pure_deposit(text, text, numeric, text, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.record_pure_deposit(text, text, numeric, text, text, uuid, integer) CASCADE;

CREATE OR REPLACE FUNCTION public.record_pure_deposit(
  p_customer_name text,
  p_customer_phone text,
  p_amount numeric,
  p_payment_method text,
  p_recorded_by text,
  p_organization_id uuid,
  p_customer_id integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id bigint := p_customer_id;
  v_sale_id uuid;
  v_org_id uuid;
  v_jwt_email text;
BEGIN
  v_jwt_email := (SELECT auth.jwt()->>'email');

  -- Resolve organization ID
  IF public.is_super_admin() THEN
    v_org_id := p_organization_id;
    IF v_org_id IS NULL AND v_customer_id IS NOT NULL THEN
      SELECT organization_id INTO v_org_id FROM public.customers WHERE id = v_customer_id;
    END IF;
    IF v_org_id IS NULL THEN
      SELECT organization_id INTO v_org_id 
      FROM public.customers 
      WHERE (phone = p_customer_phone OR name = p_customer_name)
        AND organization_id IS NOT NULL
      ORDER BY id ASC
      LIMIT 1;
    END IF;
    -- Fallback: If only 1 organization exists in the system, automatically default to it
    IF v_org_id IS NULL THEN
      IF (SELECT COUNT(*) FROM public.organizations) = 1 THEN
        SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
      END IF;
    END IF;
  ELSE
    v_org_id := public.get_my_organization_id();
    IF v_org_id IS NULL AND p_organization_id IS NOT NULL THEN
      v_org_id := p_organization_id;
    END IF;
    IF v_org_id IS NULL AND v_customer_id IS NOT NULL THEN
      SELECT organization_id INTO v_org_id FROM public.customers WHERE id = v_customer_id;
    END IF;
    IF v_org_id IS NULL THEN
      SELECT organization_id INTO v_org_id 
      FROM public.customers 
      WHERE (phone = p_customer_phone OR name = p_customer_name)
        AND organization_id IS NOT NULL
      ORDER BY id ASC
      LIMIT 1;
    END IF;
    -- Fallback: If only 1 organization exists in the system, automatically default to it
    IF v_org_id IS NULL THEN
      IF (SELECT COUNT(*) FROM public.organizations) = 1 THEN
        SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
      END IF;
    END IF;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;

  -- If customer ID was not explicitly provided, find existing or create new
  IF v_customer_id IS NULL THEN
    -- Match by valid phone number first
    IF p_customer_phone IS NOT NULL AND p_customer_phone NOT IN ('', '+233') THEN
      SELECT id INTO v_customer_id 
      FROM public.customers 
      WHERE phone = p_customer_phone AND organization_id = v_org_id
      ORDER BY id ASC
      LIMIT 1;
    END IF;

    -- Match by exact name if phone didn't match
    IF v_customer_id IS NULL AND p_customer_name IS NOT NULL AND TRIM(p_customer_name) != '' THEN
      SELECT id INTO v_customer_id 
      FROM public.customers 
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(p_customer_name)) AND organization_id = v_org_id
      ORDER BY id ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Create customer if not found
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, phone, credit_balance, organization_id)
    VALUES (p_customer_name, p_customer_phone, p_amount, v_org_id)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers 
    SET credit_balance = COALESCE(credit_balance, 0) + p_amount,
        updated_at = now()
    WHERE id = v_customer_id AND organization_id = v_org_id;
  END IF;

  -- Create sale record for pure deposit with negative balance_due representing customer credit
  INSERT INTO public.sales (
    customer_id,
    customer_name,
    total_amount,
    amount_paid,
    balance_due,
    payment_method,
    payment_status,
    notes,
    recorded_by,
    invoice_no,
    organization_id,
    created_at
  ) VALUES (
    v_customer_id,
    p_customer_name,
    0,
    p_amount,
    -p_amount,
    p_payment_method,
    'DEPOSIT',
    'Pure Deposit',
    p_recorded_by,
    'DEP-' || upper(substr(md5(random()::text), 1, 8)),
    v_org_id,
    now()
  )
  RETURNING id INTO v_sale_id;

  -- Insert Double-Entry Journal Entry
  INSERT INTO public.journal_entries (account_type, debit, credit, description, organization_id, created_at, sale_id)
  VALUES 
    (pg_catalog.upper(p_payment_method), p_amount, 0, 'Deposit received from ' || p_customer_name, v_org_id, now(), v_sale_id),
    ('CUSTOMER_DEPOSIT', 0, p_amount, 'Customer credit recorded for ' || p_customer_name, v_org_id, now(), v_sale_id);

  RETURN v_sale_id;
END;
$$;

-- Canonical 6-parameter overload (delegates to 7-parameter implementation with p_customer_id := NULL)
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
BEGIN
  RETURN public.record_pure_deposit(
    p_customer_name,
    p_customer_phone,
    p_amount,
    p_payment_method,
    p_recorded_by,
    p_organization_id,
    NULL::integer
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_pure_deposit(text, text, numeric, text, text, uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_pure_deposit(text, text, numeric, text, text, uuid) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- STEP 7: Cascade Delete Customer Function (Admin only)
-- Deletes a customer and EVERYTHING associated with them:
-- journal entries, sale items, sales, and the customer record.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_customer_cascade(integer, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.delete_customer_cascade(bigint, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.delete_customer_cascade(
  p_customer_id bigint,
  p_organization_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_sale_ids uuid[];
BEGIN
  -- 1. Authorization check
  IF public.is_super_admin() THEN
    v_org_id := p_organization_id;
    IF v_org_id IS NULL THEN
      SELECT organization_id INTO v_org_id FROM public.customers WHERE id = p_customer_id;
    END IF;
  ELSE
    v_org_id := public.get_my_organization_id();
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
        AND organization_id = v_org_id 
        AND role IN ('admin', 'super_admin')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can delete customers and their full history';
    END IF;
  END IF;

  -- 2. Verify customer exists
  IF NOT EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = p_customer_id 
      AND (v_org_id IS NULL OR organization_id = v_org_id)
  ) THEN
    RAISE EXCEPTION 'Customer not found or not in your organization';
  END IF;

  -- 3. Collect all sales belonging to this customer
  SELECT ARRAY_AGG(id) INTO v_sale_ids
  FROM public.sales
  WHERE customer_id = p_customer_id
    AND (v_org_id IS NULL OR organization_id = v_org_id);

  -- 4. Delete associated records in cascade order
  IF v_sale_ids IS NOT NULL AND array_length(v_sale_ids, 1) > 0 THEN
    -- Delete journal entries for all sales belonging to this customer
    DELETE FROM public.journal_entries
    WHERE sale_id = ANY(v_sale_ids);

    -- Delete sale items for all sales belonging to this customer
    DELETE FROM public.sale_items
    WHERE sale_id = ANY(v_sale_ids);

    -- Delete the sales themselves
    DELETE FROM public.sales
    WHERE id = ANY(v_sale_ids);
  END IF;

  -- 5. Delete customer record
  DELETE FROM public.customers
  WHERE id = p_customer_id
    AND (v_org_id IS NULL OR organization_id = v_org_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_customer_cascade(bigint, uuid) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- STEP 8: Recreate deposits view with support for all pending order types
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.deposits;

CREATE OR REPLACE VIEW public.deposits WITH (security_invoker = true) AS
SELECT 
  c.id AS customer_id,
  c.name AS customer_name,
  c.phone,
  c.organization_id,
  COALESCE(COUNT(s.id) FILTER (
    WHERE (
      s.payment_status IN ('DEPOSIT', 'PARTIAL', 'UNPAID')
      OR s.notes ILIKE '%Pure Deposit%' 
      OR s.total_amount = 0 
      OR s.balance_due < 0
      OR s.balance_due > 0
    ) 
    AND (s.notes IS NULL OR s.notes NOT ILIKE '%(Fulfilled)%')
  ), 0)::integer AS pending_sales_count,
  MAX(s.created_at) AS last_sale_date,
  COALESCE(SUM(s.balance_due), 0)::numeric AS total_balance
FROM public.customers c
LEFT JOIN public.sales s ON s.customer_id = c.id AND (s.organization_id = c.organization_id OR s.organization_id IS NULL)
GROUP BY c.id, c.name, c.phone, c.organization_id;

GRANT SELECT ON public.deposits TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- STEP 9: Historical Credit Reconciliation & Customer Balance Sync
-- ------------------------------------------------------------
DO $$
DECLARE
  v_rec RECORD;
  v_dep RECORD;
  v_total_credit_used NUMERIC;
  v_rem NUMERIC;
  v_deduct NUMERIC;
BEGIN
  -- Reconcile existing sales that used customer deposit credit
  FOR v_rec IN (
    SELECT DISTINCT s.customer_id, s.organization_id
    FROM public.sales s
    JOIN public.journal_entries j ON j.sale_id = s.id
    WHERE j.account_type = 'CUSTOMER_DEPOSIT' AND j.debit > 0
      AND s.customer_id IS NOT NULL
  ) LOOP
    SELECT COALESCE(SUM(j.debit), 0) INTO v_total_credit_used
    FROM public.journal_entries j
    JOIN public.sales s ON s.id = j.sale_id
    WHERE j.account_type = 'CUSTOMER_DEPOSIT' AND j.debit > 0
      AND s.customer_id = v_rec.customer_id;

    v_rem := v_total_credit_used;

    FOR v_dep IN (
      SELECT id, balance_due, notes
      FROM public.sales
      WHERE customer_id = v_rec.customer_id
        AND balance_due < 0
      ORDER BY created_at ASC, id ASC
    ) LOOP
      EXIT WHEN v_rem <= 0;
      v_deduct := LEAST(ABS(v_dep.balance_due), v_rem);

      IF (v_dep.balance_due + v_deduct) >= 0 THEN
        UPDATE public.sales
        SET balance_due = 0,
            notes = CASE 
              WHEN notes IS NULL OR notes = '' THEN '(Fulfilled - Credit Consumed)'
              WHEN notes ILIKE '%(Fulfilled)%' THEN notes
              ELSE notes || ' | (Fulfilled - Credit Consumed)'
            END
        WHERE id = v_dep.id;
      ELSE
        UPDATE public.sales
        SET balance_due = balance_due + v_deduct
        WHERE id = v_dep.id;
      END IF;

      v_rem := v_rem - v_deduct;
    END LOOP;
  END LOOP;

  -- Backfill customers.credit_balance to reflect active credit accurately
  UPDATE public.customers c
  SET credit_balance = COALESCE((
    SELECT ABS(SUM(s.balance_due))
    FROM public.sales s
    WHERE s.customer_id = c.id
      AND s.balance_due < 0
      AND (s.notes IS NULL OR s.notes NOT ILIKE '%(Fulfilled)%')
  ), 0);
END $$;
