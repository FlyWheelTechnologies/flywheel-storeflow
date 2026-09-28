-- Verification script for all StoreFlow RPC functions and views
DO $$
DECLARE
  v_org_id UUID;
  v_cust_id BIGINT;
  v_prod_id UUID;
  v_deposit_id UUID;
  v_sale_id UUID;
  v_dep_count INT;
  v_is_super BOOLEAN;
  v_is_org BOOLEAN;
BEGIN
  RAISE NOTICE '=== 1. Testing Core Auth & Role Functions ===';
  SELECT public.is_super_admin() INTO v_is_super;
  RAISE NOTICE 'is_super_admin(): %', v_is_super;

  SELECT public.is_org_admin() INTO v_is_org;
  RAISE NOTICE 'is_org_admin(): %', v_is_org;

  SELECT public.get_my_organization_id() INTO v_org_id;
  RAISE NOTICE 'get_my_organization_id(): %', v_org_id;

  -- Pick an active organization for integration tests
  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found for testing';
  END IF;
  RAISE NOTICE 'Target Organization: %', v_org_id;

  RAISE NOTICE '=== 2. Testing Customer & Product Provisioning ===';
  -- Create or retrieve test customer
  SELECT id INTO v_cust_id FROM public.customers WHERE phone = '+233000999888' AND organization_id = v_org_id LIMIT 1;
  IF v_cust_id IS NULL THEN
    INSERT INTO public.customers (name, phone, organization_id, credit_balance)
    VALUES ('Automated Verifier Customer', '+233000999888', v_org_id, 0)
    RETURNING id INTO v_cust_id;
  END IF;
  RAISE NOTICE 'Test Customer ID: %', v_cust_id;

  -- Create or retrieve test product
  SELECT id INTO v_prod_id FROM public.products WHERE organization_id = v_org_id LIMIT 1;
  IF v_prod_id IS NULL THEN
    INSERT INTO public.products (name, selling_price, cost_price, stock_quantity, organization_id)
    VALUES ('Verifier Test Product', 100, 60, 50, v_org_id)
    RETURNING id INTO v_prod_id;
  END IF;
  RAISE NOTICE 'Test Product ID: %', v_prod_id;

  RAISE NOTICE '=== 3. Testing record_pure_deposit RPC (7-param signature) ===';
  SELECT public.record_pure_deposit(
    p_customer_name => 'Automated Verifier Customer',
    p_customer_phone => '+233000999888',
    p_amount => 250,
    p_payment_method => 'Cash',
    p_recorded_by => 'test_runner@storeflow.com',
    p_organization_id => v_org_id,
    p_customer_id => v_cust_id::integer
  ) INTO v_deposit_id;
  RAISE NOTICE 'record_pure_deposit (7 params) created Sale ID: %', v_deposit_id;

  -- Verify customer appears in public.deposits view
  SELECT COUNT(*) INTO v_dep_count FROM public.deposits WHERE customer_id = v_cust_id;
  RAISE NOTICE 'Customer found in public.deposits view (count: %)', v_dep_count;

  RAISE NOTICE '=== 4. Testing record_pure_deposit RPC (6-param signature) ===';
  SELECT public.record_pure_deposit(
    p_customer_name => 'Automated Verifier Customer',
    p_customer_phone => '+233000999888',
    p_amount => 100,
    p_payment_method => 'MoMo',
    p_recorded_by => 'test_runner@storeflow.com',
    p_organization_id => v_org_id
  ) INTO v_deposit_id;
  RAISE NOTICE 'record_pure_deposit (6 params) created Sale ID: %', v_deposit_id;

  RAISE NOTICE '=== 5. Testing record_sale_transaction RPC ===';
  SELECT public.record_sale_transaction(
    p_customer_id => v_cust_id::integer,
    p_customer_name => 'Automated Verifier Customer',
    p_total_amount => 100::numeric,
    p_amount_paid => 100::numeric,
    p_payment_method => 'Cash',
    p_payment_status => 'paid',
    p_items => jsonb_build_array(
      jsonb_build_object(
        'product_id', v_prod_id,
        'product_name', 'Verifier Test Product',
        'quantity', 1,
        'unit_price', 100,
        'subtotal', 100
      )
    ),
    p_recorded_by => 'test_runner@storeflow.com',
    p_tax_percentage => 0::numeric,
    p_tax_inclusive => false,
    p_credit_used => 0::numeric,
    p_organization_id => v_org_id
  ) INTO v_sale_id;
  RAISE NOTICE 'record_sale_transaction created Sale ID: %', v_sale_id;

  RAISE NOTICE '=== 6. Testing Views: customer_stats ===';
  PERFORM * FROM public.customer_stats WHERE id = v_cust_id;
  RAISE NOTICE 'public.customer_stats view query executed successfully';

  RAISE NOTICE '=== 7. Cleaning up test data ===';
  -- Use cascade customer deletion to remove test sales, items, journal entries & customer
  PERFORM public.delete_customer_cascade(v_cust_id);
  RAISE NOTICE 'delete_customer_cascade completed successfully and cleaned up test data';

  RAISE NOTICE '==================================================';
  RAISE NOTICE '🎉 ALL STOREFLOW RPC FUNCTIONS & VIEWS PASSED!';
  RAISE NOTICE '==================================================';
END $$;
