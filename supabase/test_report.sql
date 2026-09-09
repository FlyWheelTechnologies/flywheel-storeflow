-- ============================================================
-- Detailed Multi-Tenant Isolation Test Report
-- ============================================================

CREATE TEMP TABLE IF NOT EXISTS temp_test_results (
  test_id INT,
  scenario TEXT,
  actor TEXT,
  expected TEXT,
  actual TEXT,
  status TEXT
);
TRUNCATE temp_test_results;
GRANT ALL ON temp_test_results TO anon, authenticated;


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
  -- -----------------------------------------------------------
  -- TEST 1: Super Admin (Godwin)
  -- -----------------------------------------------------------
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
  SELECT COUNT(*) INTO v_count FROM public.products;

  INSERT INTO temp_test_results VALUES
    (1, 'Super Admin Detection', 'godwinokro2020@gmail.com', 'is_super_admin_jwt = true', 'is_super_admin_jwt = ' || v_is_super, CASE WHEN v_is_super THEN 'PASS' ELSE 'FAIL' END),
    (2, 'Super Admin Unpinned Org', 'godwinokro2020@gmail.com', 'org_id = NULL', 'org_id = ' || COALESCE(v_my_org::text, 'NULL'), CASE WHEN v_my_org IS NULL THEN 'PASS' ELSE 'FAIL' END),
    (3, 'Super Admin Cross-Tenant Products Visibility', 'godwinokro2020@gmail.com', 'Count >= 3', 'Count = ' || v_count, CASE WHEN v_count >= 3 THEN 'PASS' ELSE 'FAIL' END);

  -- -----------------------------------------------------------
  -- TEST 2: Nana Ampadu Ent. (Brand New Business)
  -- -----------------------------------------------------------
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
  SELECT COUNT(*) INTO v_count FROM public.products;

  INSERT INTO temp_test_results VALUES
    (4, 'Tenant Admin Non-Super', 'nana@ampadu.com', 'is_super_admin_jwt = false', 'is_super_admin_jwt = ' || v_is_super, CASE WHEN NOT v_is_super THEN 'PASS' ELSE 'FAIL' END),
    (5, 'Tenant Org Scoping', 'nana@ampadu.com', 'org_id = ' || v_nana_org_id, 'org_id = ' || COALESCE(v_my_org::text, 'NULL'), CASE WHEN v_my_org = v_nana_org_id THEN 'PASS' ELSE 'FAIL' END),
    (6, 'Tenant Product Scoping (Only Nana Ampadu Prod 1, hides 3 other tenant prods)', 'nana@ampadu.com', 'Count = 1 (only its own)', 'Count = ' || v_count, CASE WHEN v_count = 1 THEN 'PASS' ELSE 'FAIL' END);


  SELECT COUNT(*) INTO v_count FROM public.sales;
  INSERT INTO temp_test_results VALUES
    (7, 'Zero Sales Leakage (New Org)', 'nana@ampadu.com', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  SELECT COUNT(*) INTO v_count FROM public.customers;
  INSERT INTO temp_test_results VALUES
    (8, 'Zero Customers Leakage (New Org)', 'nana@ampadu.com', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- -----------------------------------------------------------
  -- TEST 3: Final Biz (Existing Tenant with 1 Product)
  -- -----------------------------------------------------------
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
  SELECT COUNT(*) INTO v_count FROM public.products;

  INSERT INTO temp_test_results VALUES
    (9, 'Final Biz Product Scoping', 'joa@final.com', 'Count = 1 (only its own)', 'Count = ' || v_count, CASE WHEN v_count = 1 THEN 'PASS' ELSE 'FAIL' END);

  -- Can Joa see other profiles?
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id = v_nana_uid;
  INSERT INTO temp_test_results VALUES
    (10, 'Profiles Isolation (Cannot see other tenant staff)', 'joa@final.com', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- -----------------------------------------------------------
  -- TEST 4: Anonymous Caller
  -- -----------------------------------------------------------
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.email', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT COUNT(*) INTO v_count FROM public.products;
  INSERT INTO temp_test_results VALUES
    (11, 'Anonymous Products Access', 'anonymous', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  SELECT COUNT(*) INTO v_count FROM public.sales;
  INSERT INTO temp_test_results VALUES
    (12, 'Anonymous Sales Access', 'anonymous', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

END $$;

SELECT test_id, scenario, actor, expected, actual, status FROM temp_test_results ORDER BY test_id;
