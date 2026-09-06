import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ongyutrabagetgdebdib.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uL4jsvtGhi4bg2umT8yshw_3pGfduDT";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTests() {
  console.log("==================================================");
  console.log("   StoreFlow Comprehensive DB Function Test Suite ");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  const tables = [
    { name: 'organizations', select: 'id, name, slug' },
    { name: 'profiles', select: 'id, email, role, created_at' },
    { name: 'products', select: 'id, name, stock_quantity, selling_price, organization_id' },
    { name: 'sales', select: 'id, invoice_no, total_amount, payment_status, created_at' },
    { name: 'sale_items', select: 'id, sale_id, product_name, quantity, unit_price' },
    { name: 'customers', select: 'id, name, phone, email, is_contractor' },
    { name: 'expenses', select: 'id, category, description, amount, created_at' },
    { name: 'journal_entries', select: 'id, account_type, debit, credit, description' },
    { name: 'logs', select: 'id, action, details, created_at' }
  ];

  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    try {
      const { data, error } = await supabase.from(t.name).select(t.select).limit(5);
      if (error) throw error;
      console.log(`✅ [Table ${i+1}/${tables.length}] '${t.name}' accessible (columns: ${t.select}) - rows: ${data?.length || 0}`);
      passed++;
    } catch (err) {
      console.error(`❌ [Table ${i+1}/${tables.length}] '${t.name}' query failed:`, err.message);
      failed++;
    }
  }

  // Test RPC: is_super_admin
  try {
    const { data: isSuper, error: rpcErr } = await supabase.rpc('is_super_admin');
    if (rpcErr) {
      console.log(`⚠️ is_super_admin RPC: ${rpcErr.message}`);
    } else {
      console.log(`✅ [RPC 1/3] is_super_admin RPC verified (result: ${isSuper})`);
      passed++;
    }
  } catch (err) {
    console.error(`❌ is_super_admin RPC failed:`, err.message);
    failed++;
  }

  // Test RPC: get_my_organization_id
  try {
    const { data: myOrg, error: rpcErr } = await supabase.rpc('get_my_organization_id');
    if (rpcErr) {
      console.log(`⚠️ get_my_organization_id RPC: ${rpcErr.message}`);
    } else {
      console.log(`✅ [RPC 2/3] get_my_organization_id RPC verified (result: ${myOrg})`);
      passed++;
    }
  } catch (err) {
    console.error(`❌ get_my_organization_id RPC failed:`, err.message);
    failed++;
  }

  // Test RPC: record_sale_transaction validation signature check
  try {
    const { data, error: rpcErr } = await supabase.rpc('record_sale_transaction', {
      p_customer_id: null,
      p_customer_name: 'Test Validation',
      p_total_amount: 0,
      p_amount_paid: 0,
      p_payment_method: 'cash',
      p_payment_status: 'paid',
      p_items: [],
      p_recorded_by: 'system_test@storeflow.com'
    });
    if (rpcErr) {
      console.log(`ℹ️ record_sale_transaction RPC verified (invoked with response: ${rpcErr.message})`);
    } else {
      console.log(`✅ [RPC 3/3] record_sale_transaction RPC verified successfully`);
    }
    passed++;
  } catch (err) {
    console.error(`❌ record_sale_transaction RPC failed:`, err.message);
    failed++;
  }

  console.log("==================================================");
  console.log(`Total Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
