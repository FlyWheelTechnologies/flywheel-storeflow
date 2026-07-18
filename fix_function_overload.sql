-- Fix function overload ambiguity for record_sale_transaction
-- Drop the old function signature that causes the ambiguity

-- First, drop the old 11-parameter version
DROP FUNCTION IF EXISTS public.record_sale_transaction(
  integer,
  text,
  numeric,
  numeric,
  text,
  text,
  jsonb,
  text,
  numeric,
  boolean
) CASCADE;

-- Recreate the correct 13-parameter version (from repair_sales.sql)
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
 SET search_path = ''
AS $function$
DECLARE
  v_sale_id UUID;
  v_tax_amount NUMERIC := 0;
  v_net_amount NUMERIC := 0;
  v_total_with_tax NUMERIC;
  v_item RECORD;
BEGIN
  -- Auto-generate INV-xxx sequence number if not provided (manual sales)
  IF p_invoice_no IS NULL THEN
    DECLARE
      v_max_seq INTEGER;
    BEGIN
      SELECT COALESCE(MAX(pg_catalog.substring(invoice_no, 5)::integer), 0)
      INTO v_max_seq
      FROM public.sales
      WHERE invoice_no LIKE 'INV-%';
      
      p_invoice_no := 'INV-' || pg_catalog.lpad((v_max_seq + 1)::text, 3, '0');
    END;
  END IF;

  -- Tax Calculation
  IF p_tax_inclusive THEN
    v_net_amount := ROUND(p_total_amount / (1 + (p_tax_percentage / 100)), 1);
    v_tax_amount := ROUND(p_total_amount - v_net_amount, 1);
    v_total_with_tax := ROUND(p_total_amount, 1);
  ELSE
    v_tax_amount := ROUND(p_total_amount * (p_tax_percentage / 100), 1);
    v_net_amount := ROUND(p_total_amount, 1);
    v_total_with_tax := ROUND(p_total_amount + v_tax_amount, 1);
  END IF;

  -- Insert Sale Record (with custom created_at and invoice_no support)
  INSERT INTO public.sales (
    customer_id, customer_name, total_amount, amount_paid, 
    balance_due, payment_status, payment_method, recorded_by,
    tax_percentage, tax_inclusive, tax_amount, created_at, invoice_no
  )
  VALUES (
    p_customer_id, p_customer_name, 
    v_total_with_tax, 
    ROUND(p_amount_paid + p_credit_used, 1),
    ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 1),
    p_payment_status, p_payment_method, p_recorded_by,
    p_tax_percentage, p_tax_inclusive, v_tax_amount,
    COALESCE(p_created_at, pg_catalog.now()),
    p_invoice_no
  ) RETURNING id INTO v_sale_id;

  -- Process Items
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id UUID, product_name TEXT, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES (v_sale_id, v_item.product_id, v_item.product_name, v_item.quantity, v_item.unit_price, ROUND(v_item.subtotal, 1));
    
    UPDATE public.products SET stock_quantity = stock_quantity - v_item.quantity WHERE id = v_item.product_id;
  END LOOP;

  -- Journaling (with custom created_at support)
  INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at) 
  VALUES (v_sale_id, 'REVENUE', v_net_amount, 'Revenue from Sale #' || v_sale_id, COALESCE(p_created_at, pg_catalog.now()));
  
  IF v_tax_amount > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, credit, description, created_at) 
    VALUES (v_sale_id, 'TAX_PAYABLE', v_tax_amount, 'Tax collected', COALESCE(p_created_at, pg_catalog.now()));
  END IF;
  
  IF p_amount_paid > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at) 
    VALUES (v_sale_id, pg_catalog.upper(p_payment_method), ROUND(p_amount_paid, 1), 'Payment received', COALESCE(p_created_at, pg_catalog.now()));
  END IF;

  IF p_credit_used > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at) 
    VALUES (v_sale_id, 'CUSTOMER_DEPOSIT', ROUND(p_credit_used, 1), 'Applied from customer credit', COALESCE(p_created_at, pg_catalog.now()));
  END IF;
  
  IF (v_total_with_tax - (p_amount_paid + p_credit_used)) > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description, created_at) 
    VALUES (v_sale_id, 'ACCOUNTS_RECEIVABLE', ROUND(v_total_with_tax - (p_amount_paid + p_credit_used), 1), 'Debt recorded', COALESCE(p_created_at, pg_catalog.now()));
  END IF;

  RETURN v_sale_id;
END;
$function$;

-- Explicit API grants for secure defaults compatibility
GRANT EXECUTE ON FUNCTION public.record_sale_transaction(
  integer, text, numeric, numeric, text, text, jsonb, text, numeric, boolean, numeric, timestamptz, text
) TO anon, authenticated, service_role;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
