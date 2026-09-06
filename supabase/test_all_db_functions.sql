-- Test script to verify all RPC database functions
DO $$
DECLARE
  v_org_id UUID;
  v_prod_id UUID;
  v_cust_id BIGINT;
  v_sale_id UUID;
  v_deposit_id UUID;
  v_is_super BOOLEAN;
BEGIN
  RAISE NOTICE '=== Starting Database Functions Test Suite ===';

  -- 1. Test is_super_admin()
  SELECT public.is_super_admin() INTO v_is_super;
  RAISE NOTICE '1. is_super_admin() returned: %', v_is_super;

  -- 2. Test get_my_organization_id()
  SELECT public.get_my_organization_id() INTO v_org_id;
  RAISE NOTICE '2. get_my_organization_id() returned: %', v_org_id;

  -- 3. Get or create a temporary organization for testing
  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug) VALUES ('Test Org', 'test-org-db') RETURNING id INTO v_org_id;
  END IF;
  RAISE NOTICE '3. Using Organization ID: %', v_org_id;

  -- 4. Get or create a customer
  SELECT id INTO v_cust_id FROM public.customers WHERE organization_id = v_org_id LIMIT 1;
  IF v_cust_id IS NULL THEN
    INSERT INTO public.customers (name, phone, organization_id)
    VALUES ('Test Customer', '0241234567', v_org_id)
    RETURNING id INTO v_cust_id;
  END IF;
  RAISE NOTICE '4. Using Customer ID: %', v_cust_id;

  -- 5. Get or create a product
  SELECT id INTO v_prod_id FROM public.products WHERE organization_id = v_org_id LIMIT 1;
  IF v_prod_id IS NULL THEN
    INSERT INTO public.products (name, selling_price, cost_price, stock_quantity, organization_id)
    VALUES ('Test Product', 50, 30, 100, v_org_id)
    RETURNING id INTO v_prod_id;
  END IF;
  RAISE NOTICE '5. Using Product ID: %', v_prod_id;

  -- 6. Test record_sale_transaction with Super Admin / tenant support
  SELECT public.record_sale_transaction(
    p_customer_id => v_cust_id::integer,
    p_customer_name => 'Test Customer',
    p_total_amount => 100,
    p_amount_paid => 100,
    p_payment_method => 'cash',
    p_payment_status => 'paid',
    p_items => jsonb_build_array(
      jsonb_build_object(
        'product_id', v_prod_id,
        'quantity', 2,
        'unit_price', 50,
        'cost_price', 30,
        'product_name', 'Test Product'
      )
    ),
    p_recorded_by => 'test@storeflow.com',
    p_tax_percentage => 0,
    p_tax_inclusive => true,
    p_credit_used => 0,
    p_created_at => now(),
    p_invoice_no => 'TEST-INV-001',
    p_organization_id => v_org_id
  ) INTO v_sale_id;
  RAISE NOTICE '6. record_sale_transaction SUCCESS: Sale ID %', v_sale_id;

  -- 7. Test record_pure_deposit
  SELECT public.record_pure_deposit(
    p_customer_name => 'Test Customer',
    p_customer_phone => '0241234567',
    p_amount => 200,
    p_payment_method => 'MoMo',
    p_recorded_by => 'test@storeflow.com',
    p_organization_id => v_org_id
  ) INTO v_deposit_id;
  RAISE NOTICE '7. record_pure_deposit SUCCESS: Deposit Sale ID %', v_deposit_id;

  -- 8. Test fulfill_pure_deposit
  PERFORM public.fulfill_pure_deposit(
    p_sale_id => v_deposit_id,
    p_items => jsonb_build_array(
      jsonb_build_object(
        'product_id', v_prod_id,
        'quantity', 1,
        'unit_price', 50,
        'cost_price', 30,
        'product_name', 'Test Product'
      )
    )
  );
  RAISE NOTICE '8. fulfill_pure_deposit SUCCESS for %', v_deposit_id;

  -- 9. Clean up test records
  DELETE FROM public.sales WHERE id IN (v_sale_id, v_deposit_id);
  RAISE NOTICE '9. Cleaned up test sales';

  -- 10. Test log_action
  PERFORM public.log_action('TEST_AUDIT', 'Database functions test completed successfully');
  RAISE NOTICE '10. log_action SUCCESS';

  RAISE NOTICE '=== ALL RPC DATABASE FUNCTIONS PASSED SUCCESSFULLY ===';
END $$;
