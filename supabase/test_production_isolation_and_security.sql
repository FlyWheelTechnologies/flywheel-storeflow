-- ==============================================================================
-- PRODUCTION MULTI-TENANT ISOLATION & FUNCTION SECURITY AUDIT TEST SUITE
-- ==============================================================================

CREATE TEMP TABLE IF NOT EXISTS test_audit_results (
  test_no INT,
  category TEXT,
  test_name TEXT,
  actor_email TEXT,
  expected_outcome TEXT,
  actual_outcome TEXT,
  result TEXT
);
TRUNCATE test_audit_results;
GRANT ALL ON test_audit_results TO anon, authenticated, postgres;

DO $$
DECLARE
  v_orca_org_id UUID := '7ee09955-404a-446a-9db2-52127af0455a';
  v_final_org_id UUID := 'afad1415-025f-43fb-b455-cb8a2fe4916c';
  v_nana_org_id UUID := 'dec13f3c-585f-4ca7-a8ac-77f44e4f584b';
  
  v_godwin_uid UUID := 'b66dff1c-60c3-4a09-b8af-aaee858cd633';
  v_nana_uid UUID := '13beb0e9-5abe-4059-ae00-b86e976d7617';
  v_joa_uid UUID := '00c64e35-7222-4c84-969a-7c759bc97d46';

  v_count INT;
  v_updated INT;
  v_deleted INT;
  v_is_super BOOLEAN;
  v_is_admin BOOLEAN;
  v_my_org UUID;
  v_caught_error TEXT;
  v_new_sale_id UUID;
  v_sale_org_id UUID;
  v_target_prod_id UUID;
BEGIN
  -- Find an existing product in Final Biz for tamper testing
  SELECT id INTO v_target_prod_id FROM public.products WHERE organization_id = v_final_org_id LIMIT 1;

  -- ============================================================================
  -- CATEGORY 1: CORE FUNCTION IDENTITY & RESOLUTION
  -- ============================================================================

  -- 1.1 Super Admin (Godwin) Identity Verification
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

  INSERT INTO test_audit_results VALUES
    (1, 'Auth Functions', 'Super Admin JWT Recognition', 'godwinokro2020@gmail.com', 'is_super_admin_jwt = true', 'is_super_admin_jwt = ' || v_is_super, CASE WHEN v_is_super THEN 'PASS' ELSE 'FAIL' END),
    (2, 'Auth Functions', 'Super Admin Has No Default Org Pinning', 'godwinokro2020@gmail.com', 'get_my_organization_id_jwt = NULL', 'get_my_organization_id_jwt = ' || COALESCE(v_my_org::text, 'NULL'), CASE WHEN v_my_org IS NULL THEN 'PASS' ELSE 'FAIL' END);

  -- 1.2 Tenant Admin (Nana Ampadu) Identity Verification
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
  v_is_admin := public.is_org_admin_jwt();
  v_my_org := public.get_my_organization_id_jwt();

  INSERT INTO test_audit_results VALUES
    (3, 'Auth Functions', 'Tenant Admin is NOT Super Admin', 'nana@ampadu.com', 'is_super_admin_jwt = false', 'is_super_admin_jwt = ' || v_is_super, CASE WHEN NOT v_is_super THEN 'PASS' ELSE 'FAIL' END),
    (4, 'Auth Functions', 'Tenant Admin is Recognized as Org Admin', 'nana@ampadu.com', 'is_org_admin_jwt = true', 'is_org_admin_jwt = ' || v_is_admin, CASE WHEN v_is_admin THEN 'PASS' ELSE 'FAIL' END),
    (5, 'Auth Functions', 'Tenant Org Scoped Accurately to Nana Ampadu Org', 'nana@ampadu.com', 'org_id = ' || v_nana_org_id, 'org_id = ' || COALESCE(v_my_org::text, 'NULL'), CASE WHEN v_my_org = v_nana_org_id THEN 'PASS' ELSE 'FAIL' END);

  -- 1.3 Anonymous Caller Verification
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.email', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  v_is_super := public.is_super_admin_jwt();
  v_my_org := public.get_my_organization_id_jwt();

  INSERT INTO test_audit_results VALUES
    (6, 'Auth Functions', 'Anonymous Caller is NOT Super Admin', 'anon', 'is_super_admin_jwt = false', 'is_super_admin_jwt = ' || v_is_super, CASE WHEN NOT v_is_super THEN 'PASS' ELSE 'FAIL' END),
    (7, 'Auth Functions', 'Anonymous Caller Has NULL Org ID', 'anon', 'org_id = NULL', 'org_id = ' || COALESCE(v_my_org::text, 'NULL'), CASE WHEN v_my_org IS NULL THEN 'PASS' ELSE 'FAIL' END);


  -- ============================================================================
  -- CATEGORY 2: CROSS-TENANT DATA LEAKAGE PREVENTION (READ ISOLATION)
  -- ============================================================================

  -- Persona: Nana Ampadu Ent. (Brand New Business)
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

  -- 2.1 Products Isolation
  SELECT COUNT(*) INTO v_count FROM public.products;
  INSERT INTO test_audit_results VALUES
    (8, 'Read Isolation', 'Nana Ampadu Products (Hides Orca Deco & Final Biz)', 'nana@ampadu.com', 'Count = 1 (Only Nana Prod 1)', 'Count = ' || v_count, CASE WHEN v_count = 1 THEN 'PASS' ELSE 'FAIL' END);

  -- 2.2 Sales Isolation (Zero Leakage)
  SELECT COUNT(*) INTO v_count FROM public.sales;
  INSERT INTO test_audit_results VALUES
    (9, 'Read Isolation', 'Nana Ampadu Sales (Zero cross-tenant leakage)', 'nana@ampadu.com', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 2.3 Customers Isolation (Zero Leakage)
  SELECT COUNT(*) INTO v_count FROM public.customers;
  INSERT INTO test_audit_results VALUES
    (10, 'Read Isolation', 'Nana Ampadu Customers (Zero cross-tenant leakage)', 'nana@ampadu.com', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 2.4 Expenses Isolation (Zero Leakage)
  SELECT COUNT(*) INTO v_count FROM public.expenses;
  INSERT INTO test_audit_results VALUES
    (11, 'Read Isolation', 'Nana Ampadu Expenses (Zero cross-tenant leakage)', 'nana@ampadu.com', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 2.5 Journal Entries Isolation (Zero Leakage)
  SELECT COUNT(*) INTO v_count FROM public.journal_entries;
  INSERT INTO test_audit_results VALUES
    (12, 'Read Isolation', 'Nana Ampadu Journal Entries (Zero cross-tenant leakage)', 'nana@ampadu.com', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 2.6 Audit Logs Isolation (Zero Leakage of other tenants)
  SELECT COUNT(*) INTO v_count FROM public.logs WHERE organization_id = v_orca_org_id;
  INSERT INTO test_audit_results VALUES
    (13, 'Read Isolation', 'Nana Ampadu Access to Orca Deco Logs Blocked', 'nana@ampadu.com', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 2.7 Profiles Isolation (Staff visibility)
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id = v_joa_uid;
  INSERT INTO test_audit_results VALUES
    (14, 'Read Isolation', 'Nana Ampadu Viewing Final Biz Staff Profile Blocked', 'nana@ampadu.com', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);


  -- ============================================================================
  -- CATEGORY 3: CROSS-TENANT MUTATION TAMPERING DEFENSE (WRITE ISOLATION)
  -- ============================================================================

  -- 3.1 Cross-Tenant Product INSERT Attack
  -- Nana attempts to inject a product into Final Biz's organization
  v_caught_error := 'NONE';
  BEGIN
    INSERT INTO public.products (name, category, selling_price, cost_price, stock_quantity, low_stock_threshold, organization_id)
    VALUES ('Malicious Injected Product', 'General', 100, 50, 10, 1, v_final_org_id);
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
  END;

  INSERT INTO test_audit_results VALUES
    (15, 'Write Tamper Defense', 'Malicious Cross-Tenant Product INSERT Blocked', 'nana@ampadu.com', 'Blocked / RLS Violation', CASE WHEN v_caught_error != 'NONE' THEN 'Blocked: ' || v_caught_error ELSE 'LEAK / ALLOWED' END, CASE WHEN v_caught_error != 'NONE' THEN 'PASS' ELSE 'FAIL' END);

  -- 3.2 Cross-Tenant Product UPDATE Attack
  -- Nana attempts to modify Final Biz's product selling_price to 0.01
  UPDATE public.products 
  SET selling_price = 0.01 
  WHERE id = v_target_prod_id AND organization_id = v_final_org_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO test_audit_results VALUES
    (16, 'Write Tamper Defense', 'Malicious Cross-Tenant Product UPDATE Blocked', 'nana@ampadu.com', '0 rows affected', v_updated || ' rows affected', CASE WHEN v_updated = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 3.3 Cross-Tenant Product DELETE Attack
  -- Nana attempts to delete Final Biz's product
  DELETE FROM public.products 
  WHERE id = v_target_prod_id AND organization_id = v_final_org_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO test_audit_results VALUES
    (17, 'Write Tamper Defense', 'Malicious Cross-Tenant Product DELETE Blocked', 'nana@ampadu.com', '0 rows affected', v_deleted || ' rows affected', CASE WHEN v_deleted = 0 THEN 'PASS' ELSE 'FAIL' END);

  -- 3.4 Cross-Tenant Customer INSERT Attack
  v_caught_error := 'NONE';
  BEGIN
    INSERT INTO public.customers (name, phone, email, address, organization_id)
    VALUES ('Hacked Customer', '0555555555', 'hack@final.com', 'Accra', v_final_org_id);
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
  END;

  INSERT INTO test_audit_results VALUES
    (18, 'Write Tamper Defense', 'Malicious Cross-Tenant Customer INSERT Blocked', 'nana@ampadu.com', 'Blocked / RLS Violation', CASE WHEN v_caught_error != 'NONE' THEN 'Blocked: ' || v_caught_error ELSE 'LEAK / ALLOWED' END, CASE WHEN v_caught_error != 'NONE' THEN 'PASS' ELSE 'FAIL' END);

  -- 3.5 Cross-Tenant Expense INSERT Attack
  v_caught_error := 'NONE';
  BEGIN
    INSERT INTO public.expenses (category, amount, description, recorded_by, organization_id)
    VALUES ('Fraud Expense', 99999, 'Hacked expense', 'Nana Admin', v_final_org_id);
  EXCEPTION WHEN OTHERS THEN
    v_caught_error := SQLERRM;
  END;

  INSERT INTO test_audit_results VALUES
    (19, 'Write Tamper Defense', 'Malicious Cross-Tenant Expense INSERT Blocked', 'nana@ampadu.com', 'Blocked / RLS Violation', CASE WHEN v_caught_error != 'NONE' THEN 'Blocked: ' || v_caught_error ELSE 'LEAK / ALLOWED' END, CASE WHEN v_caught_error != 'NONE' THEN 'PASS' ELSE 'FAIL' END);


  -- ============================================================================
  -- CATEGORY 4: RPC STORED PROCEDURE SPOOFING & AUTO-SCOPING
  -- ============================================================================

  -- 4.1 RPC record_sale_transaction: Caller passes another tenant's org_id
  -- The function must ignore p_organization_id and strictly enforce Nana's org_id
  v_new_sale_id := public.record_sale_transaction(
    p_customer_id := NULL,
    p_customer_name := 'Walk-in Test',
    p_total_amount := 50,
    p_amount_paid := 50,
    p_payment_method := 'cash',
    p_payment_status := 'PAID',
    p_items := json_build_array(json_build_object(
      'product_id', NULL,
      'product_name', 'Manual Item',
      'quantity', 1,
      'unit_price', 50,
      'subtotal', 50
    ))::jsonb,
    p_recorded_by := 'Nana Admin',
    p_organization_id := v_final_org_id -- Attacker tries to record sale into Final Biz!
  );

  -- Verify which org the sale was actually assigned to:
  SELECT organization_id INTO v_sale_org_id FROM public.sales WHERE id = v_new_sale_id;

  INSERT INTO test_audit_results VALUES
    (20, 'RPC Protection', 'record_sale_transaction Re-routes Spoofed Org to Caller Org', 'nana@ampadu.com', 'Assigned to ' || v_nana_org_id, 'Assigned to ' || COALESCE(v_sale_org_id::text, 'NULL'), CASE WHEN v_sale_org_id = v_nana_org_id THEN 'PASS' ELSE 'FAIL' END);

  -- Clean up test sale
  DELETE FROM public.sales WHERE id = v_new_sale_id;

  -- 4.2 Auto-scoping trigger: auto_set_tenant_organization_id
  -- When Nana inserts a legitimate product without passing organization_id, trigger must auto-fill Nana's org
  INSERT INTO public.products (name, category, selling_price, cost_price, stock_quantity, low_stock_threshold)
  VALUES ('Auto-Scoped Nana Item', 'General', 25, 15, 5, 1)
  RETURNING id, organization_id INTO v_target_prod_id, v_sale_org_id;

  INSERT INTO test_audit_results VALUES
    (21, 'Trigger Protection', 'auto_set_tenant_organization_id auto-assigns caller org', 'nana@ampadu.com', 'Auto-assigned ' || v_nana_org_id, 'Assigned ' || COALESCE(v_sale_org_id::text, 'NULL'), CASE WHEN v_sale_org_id = v_nana_org_id THEN 'PASS' ELSE 'FAIL' END);

  -- Clean up test product
  DELETE FROM public.products WHERE id = v_target_prod_id;


  -- ============================================================================
  -- CATEGORY 5: ANONYMOUS & PUBLIC ACCESS SHUTDOWN
  -- ============================================================================
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.email', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT COUNT(*) INTO v_count FROM public.products;
  INSERT INTO test_audit_results VALUES
    (22, 'Anonymous Lockout', 'Zero Anonymous Products Access', 'anon', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  SELECT COUNT(*) INTO v_count FROM public.sales;
  INSERT INTO test_audit_results VALUES
    (23, 'Anonymous Lockout', 'Zero Anonymous Sales Access', 'anon', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  SELECT COUNT(*) INTO v_count FROM public.customers;
  INSERT INTO test_audit_results VALUES
    (24, 'Anonymous Lockout', 'Zero Anonymous Customers Access', 'anon', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  SELECT COUNT(*) INTO v_count FROM public.expenses;
  INSERT INTO test_audit_results VALUES
    (25, 'Anonymous Lockout', 'Zero Anonymous Expenses Access', 'anon', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  SELECT COUNT(*) INTO v_count FROM public.journal_entries;
  INSERT INTO test_audit_results VALUES
    (26, 'Anonymous Lockout', 'Zero Anonymous Journal Entries Access', 'anon', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

  SELECT COUNT(*) INTO v_count FROM public.profiles;
  INSERT INTO test_audit_results VALUES
    (27, 'Anonymous Lockout', 'Zero Anonymous Staff Profiles Access', 'anon', 'Count = 0', 'Count = ' || v_count, CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END);

END $$;

SELECT test_no, category, test_name, actor_email, expected_outcome, actual_outcome, result FROM test_audit_results ORDER BY test_no;
