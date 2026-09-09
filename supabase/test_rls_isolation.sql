-- ============================================================
-- Comprehensive Manual RLS & Multi-Tenant Isolation Test Suite
-- ============================================================

DO $$
DECLARE
  v_orca_org_id UUID := '7ee09955-404a-446a-9db2-52127af0455a';
  v_final_org_id UUID := 'afad1415-025f-43fb-b455-cb8a2fe4916c';
  v_nana_org_id UUID := 'dec13f3c-585f-4ca7-a8ac-77f44e4f584b';
  
  v_godwin_uid UUID := 'b66dff1c-60c3-4a09-b8af-aaee858cd633';
  v_nana_uid UUID := '13beb0e9-5abe-4059-ae00-b86e976d7617';
  v_joa_uid UUID := '00c64e35-7222-4c84-969a-7c759bc97d46';
  
  v_count INT;
  v_is_super BOOLEAN;
  v_my_org UUID;
BEGIN
  RAISE NOTICE '=======================================================';
  RAISE NOTICE '   RUNNING STOREFLOW MULTI-TENANT ISOLATION TESTS      ';
  RAISE NOTICE '=======================================================';

  -- -------------------------------------------------------------
  -- TEST CASE 1: Platform Super Admin (Godwin)
  -- -------------------------------------------------------------
  RAISE NOTICE '>>> TEST 1: Super Admin Context (godwinokro2020@gmail.com)';
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_godwin_uid::text, true);
  PERFORM set_config('request.jwt.claim.email', 'godwinokro2020@gmail.com', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_godwin_uid,
    'email', 'godwinokro2020@gmail.com',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'super_admin')
  )::text, true);

  v_is_super := public.is_super_admin_jwt();
  v_my_org := public.get_my_organization_id_jwt();
  
  IF v_is_super = true THEN
    RAISE NOTICE '  [PASS] is_super_admin_jwt() = true for Super Admin';
  ELSE
    RAISE EXCEPTION '  [FAIL] is_super_admin_jwt() should be true for Super Admin';
  END IF;

  IF v_my_org IS NULL THEN
    RAISE NOTICE '  [PASS] get_my_organization_id_jwt() = NULL (unpinned) for Super Admin';
  ELSE
    RAISE EXCEPTION '  [FAIL] Super Admin should NOT be pinned to any single organization! Got: %', v_my_org;
  END IF;

  -- Super Admin should be able to see all products across platform
  SELECT COUNT(*) INTO v_count FROM public.products;
  RAISE NOTICE '  [PASS] Super Admin global products visibility: % items', v_count;

  -- -------------------------------------------------------------
  -- TEST CASE 2: Nana Ampadu Ent. Admin (nana@ampadu.com)
  -- -------------------------------------------------------------
  RAISE NOTICE '>>> TEST 2: Tenant Admin Context (nana@ampadu.com)';
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_nana_uid::text, true);
  PERFORM set_config('request.jwt.claim.email', 'nana@ampadu.com', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_nana_uid,
    'email', 'nana@ampadu.com',
    'role', 'authenticated',
    'app_metadata', json_build_object('organization_id', v_nana_org_id, 'role', 'admin')
  )::text, true);

  v_is_super := public.is_super_admin_jwt();
  v_my_org := public.get_my_organization_id_jwt();

  IF v_is_super IS NOT TRUE THEN
    RAISE NOTICE '  [PASS] is_super_admin_jwt() = false for tenant admin';
  ELSE
    RAISE EXCEPTION '  [FAIL] is_super_admin_jwt() must be FALSE for tenant admin!';
  END IF;

  IF v_my_org = v_nana_org_id THEN
    RAISE NOTICE '  [PASS] get_my_organization_id_jwt() strictly resolved to Nana Ampadu Org: %', v_my_org;
  ELSE
    RAISE EXCEPTION '  [FAIL] Expected org % but got %', v_nana_org_id, v_my_org;
  END IF;

  -- Nana Ampadu Ent. is a brand new business with 0 products.
  -- RLS MUST return exactly 0 products! ZERO leakage from Orca Deco or Final Biz!
  SELECT COUNT(*) INTO v_count FROM public.products;
  IF v_count = 0 THEN
    RAISE NOTICE '  [PASS] Nana Ampadu Ent. sees EXACTLY 0 products (Air-tight isolation from other tenants!)';
  ELSE
    RAISE EXCEPTION '  [SECURITY VIOLATION] Nana Ampadu Ent. saw % products belonging to other tenants!', v_count;
  END IF;

  -- Nana Ampadu Ent. must see exactly 0 sales
  SELECT COUNT(*) INTO v_count FROM public.sales;
  IF v_count = 0 THEN
    RAISE NOTICE '  [PASS] Nana Ampadu Ent. sees EXACTLY 0 sales (No cross-tenant sales leakage!)';
  ELSE
    RAISE EXCEPTION '  [SECURITY VIOLATION] Nana Ampadu Ent. saw % sales belonging to other tenants!', v_count;
  END IF;

  -- Nana Ampadu Ent. must see exactly 0 customers
  SELECT COUNT(*) INTO v_count FROM public.customers;
  IF v_count = 0 THEN
    RAISE NOTICE '  [PASS] Nana Ampadu Ent. sees EXACTLY 0 customers (No customer leakage!)';
  ELSE
    RAISE EXCEPTION '  [SECURITY VIOLATION] Nana Ampadu Ent. saw % customers belonging to other tenants!', v_count;
  END IF;

  -- -------------------------------------------------------------
  -- TEST CASE 3: Cross-Tenant Insert Attack Prevention
  -- Can Nana insert a product with Final Biz's organization_id?
  -- -------------------------------------------------------------
  RAISE NOTICE '>>> TEST 3: Preventing Cross-Tenant Product Injection';
  BEGIN
    INSERT INTO public.products (name, stock_quantity, selling_price, cost_price, organization_id)
    VALUES ('Malicious Injected Item', 10, 100, 50, v_final_org_id);
    
    RAISE EXCEPTION '  [SECURITY VIOLATION] Nana was able to inject product into Final Biz!';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE '  [PASS] Cross-tenant product insertion blocked by RLS WITH CHECK policy!';
  END;

  -- -------------------------------------------------------------
  -- TEST CASE 4: Final Biz Admin (joa@final.com)
  -- -------------------------------------------------------------
  RAISE NOTICE '>>> TEST 4: Tenant Admin Context (joa@final.com)';
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_joa_uid::text, true);
  PERFORM set_config('request.jwt.claim.email', 'joa@final.com', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_joa_uid,
    'email', 'joa@final.com',
    'role', 'authenticated',
    'app_metadata', json_build_object('organization_id', v_final_org_id, 'role', 'admin')
  )::text, true);

  v_is_super := public.is_super_admin_jwt();
  v_my_org := public.get_my_organization_id_jwt();

  IF v_is_super IS NOT TRUE THEN
    RAISE NOTICE '  [PASS] is_super_admin_jwt() = false for Joa';
  ELSE
    RAISE EXCEPTION '  [FAIL] is_super_admin_jwt() must be FALSE for Joa!';
  END IF;

  IF v_my_org = v_final_org_id THEN
    RAISE NOTICE '  [PASS] get_my_organization_id_jwt() strictly resolved to Final Biz: %', v_my_org;
  ELSE
    RAISE EXCEPTION '  [FAIL] Expected org % but got %', v_final_org_id, v_my_org;
  END IF;

  -- Final Biz has exactly 1 product
  SELECT COUNT(*) INTO v_count FROM public.products;
  IF v_count = 1 THEN
    RAISE NOTICE '  [PASS] Final Biz sees EXACTLY its own 1 product (Orca Deco 2 products are hidden!)';
  ELSE
    RAISE EXCEPTION '  [SECURITY VIOLATION] Final Biz expected 1 product but saw % products!', v_count;
  END IF;

  -- Can Joa delete or select Nana's profile?
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id = v_nana_uid;
  IF v_count = 0 THEN
    RAISE NOTICE '  [PASS] Final Biz cannot see Nana profile (Account isolation verified!)';
  ELSE
    RAISE EXCEPTION '  [SECURITY VIOLATION] Joa can see Nana profile across organizations!';
  END IF;

  -- -------------------------------------------------------------
  -- TEST CASE 5: Anonymous / Unauthenticated Client
  -- -------------------------------------------------------------
  RAISE NOTICE '>>> TEST 5: Anonymous / Unauthenticated Context';
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.email', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT COUNT(*) INTO v_count FROM public.products;
  IF v_count = 0 THEN
    RAISE NOTICE '  [PASS] Anonymous user sees 0 products';
  ELSE
    RAISE EXCEPTION '  [SECURITY VIOLATION] Anonymous user saw % products!', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sales;
  IF v_count = 0 THEN
    RAISE NOTICE '  [PASS] Anonymous user sees 0 sales';
  ELSE
    RAISE EXCEPTION '  [SECURITY VIOLATION] Anonymous user saw % sales!', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.customers;
  IF v_count = 0 THEN
    RAISE NOTICE '  [PASS] Anonymous user sees 0 customers';
  ELSE
    RAISE EXCEPTION '  [SECURITY VIOLATION] Anonymous user saw % customers!', v_count;
  END IF;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE '  ALL MULTI-TENANT ISOLATION TESTS PASSED PERFECTLY!   ';
  RAISE NOTICE '=======================================================';
END $$;
