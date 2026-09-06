-- StoreFlow Migration: 20260903_critical_bugfixes.sql
-- Purpose:
--   1. Drop legacy/competing function overloads causing RPC ambiguity and tenant isolation bugs.
--   2. Recreate record_sale_transaction, fulfill_sale, fulfill_pure_deposit, record_pure_deposit
--      with strict multi-tenant isolation (v_org_id), SECURITY DEFINER, and tenant-scoped sequences.
--   3. Create missing tenant-isolated views: public.deposits and public.customer_stats (security_invoker = true).
--   4. Backfill any historical orphaned sales, sale_items, and journal_entries where organization_id IS NULL.
--   5. Grant permissions to authenticated and service_role.

-- ============================================================
-- STEP 1: DROP ALL COMPETING / LEGACY FUNCTION OVERLOADS
-- ============================================================
DROP FUNCTION IF EXISTS public.record_sale_transaction(text, numeric, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(uuid, text, numeric, numeric, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(bigint, text, numeric, numeric, text, text, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric, timestamptz, text) CASCADE;

-- ============================================================
-- STEP 2: RECREATE CANONICAL HARDENED record_sale_transaction
-- ============================================================
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
  p_invoice_no text DEFAULT NULL
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
BEGIN
  -- 1. Identify caller's organization
  v_org_id := public.get_my_organization_id();
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
    ROUND(p_amount_paid + p_credit_used, 2),
    ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 2),
    p_payment_status, p_payment_method, p_recorded_by,
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

  IF p_credit_used > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'CUSTOMER_DEPOSIT', ROUND(p_credit_used, 2), 'Applied from customer credit', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;
  
  IF (v_total_with_tax - (p_amount_paid + p_credit_used)) > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'ACCOUNTS_RECEIVABLE', ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 2), 'Debt recorded', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;

  RETURN v_sale_id;
END;
$function$;


-- ============================================================
-- STEP 3: RECREATE CANONICAL record_pure_deposit
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_pure_deposit(
  p_customer_name text,
  p_customer_phone text,
  p_amount numeric,
  p_payment_method text,
  p_recorded_by text
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
BEGIN
  v_org_id := public.get_my_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;
  
  -- Find or create customer (LIMIT 1 avoids multiple row errors)
  SELECT id INTO v_customer_id 
  FROM public.customers 
  WHERE name = p_customer_name 
    AND (phone = p_customer_phone OR (phone IS NULL AND p_customer_phone IS NULL))
    AND organization_id = v_org_id
  ORDER BY id ASC
  LIMIT 1;
    
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, phone, organization_id)
    VALUES (p_customer_name, p_customer_phone, v_org_id)
    RETURNING id INTO v_customer_id;
  END IF;

  -- Create sale record for pure deposit
  INSERT INTO public.sales (
    customer_id, customer_name, total_amount, amount_paid, 
    balance_due, payment_status, payment_method, recorded_by,
    notes, organization_id
  )
  VALUES (
    v_customer_id, p_customer_name, 0, p_amount, 
    -p_amount, 'DEPOSIT', p_payment_method, p_recorded_by,
    'Pure Deposit', v_org_id
  )
  RETURNING id INTO v_sale_id;

  -- Journal entries
  INSERT INTO public.journal_entries (sale_id, account_type, debit, credit, description, organization_id)
  VALUES 
    (v_sale_id, pg_catalog.upper(p_payment_method), p_amount, 0, 'Deposit received from ' || p_customer_name, v_org_id),
    (v_sale_id, 'CUSTOMER_DEPOSIT', 0, p_amount, 'Customer credit recorded', v_org_id);

  RETURN v_sale_id;
END;
$$;


-- ============================================================
-- STEP 4: RECREATE fulfill_sale WITH STRICT TENANT CHECK
-- ============================================================
CREATE OR REPLACE FUNCTION public.fulfill_sale(
  p_sale_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  v_org_id := public.get_my_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;

  UPDATE public.sales
  SET notes = CASE 
    WHEN notes IS NULL THEN '(Fulfilled)' 
    WHEN notes LIKE '%(Fulfilled)%' THEN notes 
    ELSE notes || ' (Fulfilled)' 
  END
  WHERE id = p_sale_id
    AND organization_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found or unauthorized for this organization';
  END IF;
END;
$$;


-- ============================================================
-- STEP 5: RECREATE fulfill_pure_deposit WITH CALLER ORG VERIFICATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.fulfill_pure_deposit(
  p_sale_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total numeric := 0;
  v_amount_paid numeric;
  v_customer_id bigint;
  v_customer_name text;
  v_item record;
  v_org_id uuid;
  v_my_org_id uuid;
BEGIN
  v_my_org_id := public.get_my_organization_id();
  IF v_my_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User is not associated with an active organization';
  END IF;

  -- Fetch existing sale info
  SELECT amount_paid, customer_id, customer_name, organization_id
  INTO v_amount_paid, v_customer_id, v_customer_name, v_org_id
  FROM public.sales
  WHERE id = p_sale_id;

  IF v_org_id IS NULL OR v_org_id IS DISTINCT FROM v_my_org_id THEN
    RAISE EXCEPTION 'Sale not found or unauthorized for this organization';
  END IF;

  -- Insert sale items and calculate total
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id uuid, product_name text, quantity numeric, unit_price numeric, subtotal numeric)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal, organization_id)
    VALUES (p_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.subtotal, v_org_id);
    
    -- Deduct stock strictly scoped to this organization
    UPDATE public.products 
    SET stock_quantity = stock_quantity - v_item.quantity 
    WHERE id = v_item.product_id AND organization_id = v_org_id;
    
    v_total := v_total + v_item.subtotal;
  END LOOP;

  -- Update Sale record with total and fulfillment notes
  UPDATE public.sales
  SET 
    total_amount = v_total,
    balance_due = v_total - v_amount_paid,
    notes = CASE 
      WHEN notes IS NULL THEN '(Fulfilled)' 
      WHEN notes LIKE '%(Fulfilled)%' THEN notes 
      ELSE notes || ' (Fulfilled)' 
    END
  WHERE id = p_sale_id AND organization_id = v_org_id;

  -- Update Journal Entries:
  INSERT INTO public.journal_entries (sale_id, account_type, debit, credit, description, organization_id)
  VALUES 
    (p_sale_id, 'CUSTOMER_DEPOSIT', v_amount_paid, 0, 'Applied customer deposit to sale', v_org_id),
    (p_sale_id, 'REVENUE', 0, v_total, 'Revenue from fulfilled deposit', v_org_id);

  IF v_total > v_amount_paid THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, credit, description, organization_id)
    VALUES (p_sale_id, 'ACCOUNTS_RECEIVABLE', v_total - v_amount_paid, 0, 'Debt recorded for balance due', v_org_id);
  END IF;
END;
$$;


-- ============================================================
-- STEP 6: CREATE TENANT-SCOPED VIEWS (security_invoker = true)
-- ============================================================
CREATE OR REPLACE VIEW public.deposits WITH (security_invoker = true) AS
SELECT 
  c.id AS customer_id,
  c.name AS customer_name,
  c.phone,
  c.organization_id,
  COALESCE(COUNT(s.id) FILTER (
    WHERE (
      s.payment_status = 'DEPOSIT' 
      OR s.notes ILIKE '%Pure Deposit%' 
      OR s.total_amount = 0 
      OR s.balance_due < 0
    ) 
    AND (s.notes IS NULL OR s.notes NOT ILIKE '%(Fulfilled)%')
  ), 0)::integer AS pending_sales_count,
  MAX(s.created_at) AS last_sale_date,
  COALESCE(SUM(s.balance_due), 0)::numeric AS total_balance
FROM public.customers c
LEFT JOIN public.sales s ON s.customer_id = c.id
GROUP BY c.id, c.name, c.phone, c.organization_id;

CREATE OR REPLACE VIEW public.customer_stats WITH (security_invoker = true) AS
SELECT 
  c.id,
  c.name,
  c.phone,
  c.email,
  c.address,
  c.is_contractor,
  c.created_at,
  c.organization_id,
  COALESCE(SUM(s.total_amount), 0)::numeric AS total_spent,
  COALESCE(COUNT(s.id), 0)::integer AS transaction_count
FROM public.customers c
LEFT JOIN public.sales s ON s.customer_id = c.id
GROUP BY c.id, c.name, c.phone, c.email, c.address, c.is_contractor, c.created_at, c.organization_id;


-- ============================================================
-- STEP 7: BACKFILL ORPHANED RECORDS (organization_id IS NULL)
-- ============================================================
-- 1. Attributed to profiles via recorded_by email
UPDATE public.sales s
SET organization_id = p.organization_id
FROM public.profiles p
WHERE s.organization_id IS NULL
  AND s.recorded_by = p.email
  AND p.organization_id IS NOT NULL;

-- 2. Propagate organization_id to sale_items
UPDATE public.sale_items si
SET organization_id = s.organization_id
FROM public.sales s
WHERE si.organization_id IS NULL
  AND si.sale_id = s.id
  AND s.organization_id IS NOT NULL;

-- 3. Propagate organization_id to journal_entries
UPDATE public.journal_entries je
SET organization_id = s.organization_id
FROM public.sales s
WHERE je.organization_id IS NULL
  AND je.sale_id = s.id
  AND s.organization_id IS NOT NULL;


-- ============================================================
-- STEP 8: GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_pure_deposit(text, text, numeric, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_sale(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_pure_deposit(uuid, jsonb) TO authenticated, service_role;

GRANT SELECT ON public.deposits TO authenticated, service_role;
GRANT SELECT ON public.customer_stats TO authenticated, service_role;
