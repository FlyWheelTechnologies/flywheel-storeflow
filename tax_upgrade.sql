-- 1. Add tax columns to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT TRUE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;

-- 2. Upgrade the record_sale_transaction function
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
  p_tax_inclusive boolean DEFAULT TRUE
)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  v_sale_id UUID;
  v_calculated_total NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_net_amount NUMERIC := 0;
  v_item RECORD;
BEGIN
  -- Calculate Net vs Tax
  -- If inclusive: Total = Net + Tax -> Net = Total / (1 + tax_rate)
  -- If exclusive: Total = Net * (1 + tax_rate) -> Net = Total
  
  IF p_tax_inclusive THEN
    v_net_amount := p_total_amount / (1 + (p_tax_percentage / 100));
    v_tax_amount := p_total_amount - v_net_amount;
  ELSE
    v_tax_amount := p_total_amount * (p_tax_percentage / 100);
    v_net_amount := p_total_amount;
  END IF;

  -- 1. Insert Sale
  INSERT INTO public.sales (
    customer_id, customer_name, total_amount, amount_paid, 
    balance_due, payment_status, payment_method, recorded_by,
    tax_percentage, tax_inclusive, tax_amount
  )
  VALUES (
    p_customer_id, p_customer_name, 
    CASE WHEN p_tax_inclusive THEN p_total_amount ELSE p_total_amount + v_tax_amount END, 
    p_amount_paid, 
    (CASE WHEN p_tax_inclusive THEN p_total_amount ELSE p_total_amount + v_tax_amount END) - p_amount_paid,
    p_payment_status, p_payment_method, p_recorded_by,
    p_tax_percentage, p_tax_inclusive, v_tax_amount
  ) RETURNING id INTO v_sale_id;

  -- 2. Process Items & Deduct Stock
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_price NUMERIC, subtotal NUMERIC)
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_sale_id, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.subtotal);
    
    UPDATE public.products SET stock_quantity = stock_quantity - v_item.quantity WHERE id = v_item.product_id;
  END LOOP;

  -- 3. Double-Entry Accounting
  -- Credit Revenue (Net)
  INSERT INTO public.journal_entries (sale_id, account_type, credit, description) 
  VALUES (v_sale_id, 'REVENUE', v_net_amount, 'Revenue from Sale #' || v_sale_id);
  
  -- Credit Tax Payable
  IF v_tax_amount > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, credit, description) 
    VALUES (v_sale_id, 'TAX_PAYABLE', v_tax_amount, 'Tax collected (' || p_tax_percentage || '%)');
  END IF;
  
  -- Debit Cash/Momo/Bank
  IF p_amount_paid > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description) 
    VALUES (v_sale_id, pg_catalog.upper(p_payment_method), p_amount_paid, 'Payment received');
  END IF;
  
  -- Debit Accounts Receivable
  IF ((CASE WHEN p_tax_inclusive THEN p_total_amount ELSE p_total_amount + v_tax_amount END) - p_amount_paid) > 0 THEN
    INSERT INTO public.journal_entries (sale_id, account_type, debit, description) 
    VALUES (v_sale_id, 'ACCOUNTS_RECEIVABLE', (CASE WHEN p_tax_inclusive THEN p_total_amount ELSE p_total_amount + v_tax_amount END) - p_amount_paid, 'Debt recorded');
  END IF;

  RETURN v_sale_id;
END;
$function$;
