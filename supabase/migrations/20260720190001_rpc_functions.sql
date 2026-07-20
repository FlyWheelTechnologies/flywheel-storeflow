-- StoreFlow by Flywheel — Multi-Tenant RPC Functions
-- Includes: record_sale_transaction, record_pure_deposit, fulfill_sale, fulfill_pure_deposit

-- 1. record_sale_transaction
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
BEGIN
  -- Get active user's organization ID
  v_org_id := public.get_my_organization_id();

  IF p_invoice_no IS NULL THEN
    DECLARE
      v_max_seq INTEGER;
    BEGIN
      SELECT COALESCE(MAX(pg_catalog.substring(invoice_no, 5)::integer), 0)
      INTO v_max_seq
      FROM public.sales
      WHERE invoice_no LIKE 'INV-%'
        AND organization_id = v_org_id;
      
      p_invoice_no := 'INV-' || pg_catalog.lpad((v_max_seq + 1)::text, 3, '0');
    END;
  END IF;

  IF p_tax_inclusive THEN
    v_net_amount := ROUND(p_total_amount / (1 + (p_tax_percentage / 100)), 1);
    v_tax_amount := ROUND(p_total_amount - v_net_amount, 1);
    v_total_with_tax := ROUND(p_total_amount, 1);
  ELSE
    v_tax_amount := ROUND(p_total_amount * (p_tax_percentage / 100), 1);
    v_net_amount := ROUND(p_total_amount, 1);
    v_total_with_tax := ROUND(p_total_amount + v_tax_amount, 1);
  END IF;

  INSERT INTO public.sales (
    customer_id, customer_name, total_amount, amount_paid, 
    balance_due, payment_status, payment_method, recorded_by,
    tax_percentage, tax_inclusive, tax_amount, created_at, invoice_no, organization_id
  )
  VALUES (
    p_customer_id, p_customer_name, 
    v_total_with_tax, 
    ROUND(p_amount_paid + p_credit_used, 1),
    ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 1),
    p_payment_status, p_payment_method, p_recorded_by,
    p_tax_percentage, p_tax_inclusive, v_tax_amount,
    COALESCE(p_created_at, pg_catalog.now()),
    p_invoice_no,
    v_org_id
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal, organization_id)
    VALUES (v_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, ROUND(v_item.subtotal, 1), v_org_id);
    
    UPDATE public.products 
    SET stock_quantity = stock_quantity - v_item.quantity 
    WHERE id = v_item.product_id AND organization_id = v_org_id;
  END LOOP;

  INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at, organization_id) 
  VALUES (v_sale_id, 'REVENUE', v_net_amount, 'Revenue from Sale #' || v_sale_id, COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  
  IF v_tax_amount > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'TAX_PAYABLE', v_tax_amount, 'Tax collected', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;
  
  IF p_amount_paid > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, pg_catalog.upper(p_payment_method), ROUND(p_amount_paid, 1), 'Payment received', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;

  IF p_credit_used > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'CUSTOMER_DEPOSIT', ROUND(p_credit_used, 1), 'Applied from customer credit', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;
  
  IF (v_total_with_tax - (p_amount_paid + p_credit_used)) > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at, organization_id) 
    VALUES (v_sale_id, 'ACCOUNTS_RECEIVABLE', ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 1), 'Debt recorded', COALESCE(p_created_at, pg_catalog.now()), v_org_id);
  END IF;

  RETURN v_sale_id;
END;
$function$;


-- 2. record_pure_deposit
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
  -- Get active user's organization
  v_org_id := public.get_my_organization_id();
  
  -- Find or create customer
  SELECT id INTO v_customer_id 
  FROM public.customers 
  WHERE name = p_customer_name 
    AND (phone = p_customer_phone OR (phone IS NULL AND p_customer_phone IS NULL))
    AND organization_id = v_org_id;
    
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, phone, organization_id)
    VALUES (p_customer_name, p_customer_phone, v_org_id)
    RETURNING id INTO v_customer_id;
  END IF;

  -- Create sale record for pure deposit (total_amount = 0, amount_paid = p_amount, status = DEPOSIT)
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

  -- Journal entry: Debit Cash/Momo/Bank, Credit CUSTOMER_DEPOSIT (Liability)
  INSERT INTO public.journal_entries (sale_id, account_type, debit, credit, description, organization_id)
  VALUES 
    (v_sale_id, pg_catalog.upper(p_payment_method), p_amount, 0, 'Deposit received from ' || p_customer_name, v_org_id),
    (v_sale_id, 'CUSTOMER_DEPOSIT', 0, p_amount, 'Customer credit recorded', v_org_id);

  RETURN v_sale_id;
END;
$$;


-- 3. fulfill_sale
CREATE OR REPLACE FUNCTION public.fulfill_sale(
  p_sale_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Append (Fulfilled) to notes
  UPDATE public.sales
  SET notes = CASE 
    WHEN notes IS NULL THEN '(Fulfilled)' 
    WHEN notes LIKE '%(Fulfilled)%' THEN notes 
    ELSE notes || ' (Fulfilled)' 
  END
  WHERE id = p_sale_id;
END;
$$;


-- 4. fulfill_pure_deposit
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
BEGIN
  -- Fetch existing sale info
  SELECT amount_paid, customer_id, customer_name, organization_id
  INTO v_amount_paid, v_customer_id, v_customer_name, v_org_id
  FROM public.sales
  WHERE id = p_sale_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- Insert sale items and calculate total
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id uuid, product_name text, quantity numeric, unit_price numeric, subtotal numeric)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal, organization_id)
    VALUES (p_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, v_item.subtotal, v_org_id);
    
    -- Deduct stock
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
  WHERE id = p_sale_id;

  -- Update Journal Entries:
  -- Debit CUSTOMER_DEPOSIT (Liability) up to the deposit amount used
  -- Credit REVENUE with the sale total
  -- If total > deposit, Debit ACCOUNTS_RECEIVABLE for the remainder
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


-- Explicit grants on functions
GRANT EXECUTE ON FUNCTION public.record_sale_transaction(integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric, timestamptz, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_pure_deposit(text, text, numeric, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_sale(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_pure_deposit(uuid, jsonb) TO anon, authenticated, service_role;
