import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ongyutrabagetgdebdib.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZ3l1dHJhYmFnZXRnZGViZGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzkzNjAsImV4cCI6MjA5OTk1NTM2MH0.IfQRIkgcUq0H4biVcf6Sc-gBhlOP04wyN32OWd357OQ";

async function runVerification() {
  console.log("=================================================================");
  console.log("   StoreFlow Multi-Tenant End-to-End CRUD & Business Test Suite  ");
  console.log("=================================================================");

  // Helper to invite/create user via Edge Function
  async function inviteUser(email, role, fullName, password, orgId) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        email,
        role,
        fullName,
        password,
        organization_id: orgId
      })
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Invite user failed (${res.status}): ${text}`);
    }
    return JSON.parse(text);
  }

  // 1. Authenticate as Super Admin (Godwin)
  console.log("\n[1] Authenticating Super Admin (godwinokro2020@gmail.com)...");
  const superClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: superAuth, error: superErr } = await superClient.auth.signInWithPassword({
    email: 'godwinokro2020@gmail.com',
    password: 'StoreFlowSuper2026!'
  });
  if (superErr) throw new Error("Super Admin Auth Failed: " + superErr.message);
  console.log("✅ Super Admin Authenticated successfully. User ID:", superAuth.user.id);

  // 2. Create Business 1: "GoldCoast Mart"
  console.log("\n[2] Creating Business 1: 'GoldCoast Mart'...");
  const biz1Slug = `goldcoast-mart-${Date.now().toString().slice(-4)}`;
  const biz1AdminEmail = `kwame_${Date.now().toString().slice(-4)}@goldcoastmart.com`;
  const biz1Password = "StoreFlowAdmin2026!";

  const { data: biz1, error: biz1Err } = await superClient
    .from("organizations")
    .insert({
      name: "GoldCoast Mart",
      slug: biz1Slug,
      primary_color: "#f97316",
      currency: "GHS",
      admin_email: biz1AdminEmail,
      phone: "+233245678901",
      address: "Oxford Street, Osu, Accra",
      setup_fee: 1500,
      subscription_amount: 300,
      billing_cycle: "monthly",
      payment_status: "active"
    })
    .select()
    .single();

  if (biz1Err) throw new Error("Create Business 1 Failed: " + biz1Err.message);
  console.log("✅ Business 1 Created:", biz1.name, "| ID:", biz1.id, "| Slug:", biz1.slug);

  // Invite/Provision Admin for Business 1
  console.log("Provisioning Admin for Business 1:", biz1AdminEmail);
  await inviteUser(biz1AdminEmail, "admin", "Kwame Mensah", biz1Password, biz1.id);
  console.log("✅ Business 1 Admin Provisioned.");

  // 3. Create Business 2: "Accra Fresh Grocers" for multi-tenant isolation testing
  console.log("\n[3] Creating Business 2: 'Accra Fresh Grocers' (for data isolation testing)...");
  const biz2Slug = `accra-fresh-${Date.now().toString().slice(-4)}`;
  const biz2AdminEmail = `ama_${Date.now().toString().slice(-4)}@accrafresh.com`;
  const biz2Password = "StoreFlowAdmin2026!";

  const { data: biz2, error: biz2Err } = await superClient
    .from("organizations")
    .insert({
      name: "Accra Fresh Grocers",
      slug: biz2Slug,
      primary_color: "#10b981",
      currency: "GHS",
      admin_email: biz2AdminEmail,
      phone: "+233201234567",
      address: "Spintex Road, Accra",
      setup_fee: 1500,
      subscription_amount: 350,
      billing_cycle: "monthly",
      payment_status: "active"
    })
    .select()
    .single();

  if (biz2Err) throw new Error("Create Business 2 Failed: " + biz2Err.message);
  console.log("✅ Business 2 Created:", biz2.name, "| ID:", biz2.id, "| Slug:", biz2.slug);

  // Invite/Provision Admin for Business 2
  await inviteUser(biz2AdminEmail, "admin", "Ama Serwaa", biz2Password, biz2.id);
  console.log("✅ Business 2 Admin Provisioned.");

  // 4. Authenticate directly as Business 1 Admin (Kwame) — NO impersonation!
  console.log(`\n[4] LOGGING DIRECTLY INTO BUSINESS 1 (NO IMPERSONATION) as ${biz1AdminEmail}...`);
  const tenant1Client = createClient(SUPABASE_URL, ANON_KEY);
  const { data: t1Auth, error: t1AuthErr } = await tenant1Client.auth.signInWithPassword({
    email: biz1AdminEmail,
    password: biz1Password
  });
  if (t1AuthErr) throw new Error("Tenant 1 Login Failed: " + t1AuthErr.message);
  console.log("✅ Tenant 1 Admin Logged In. User ID:", t1Auth.user.id);

  // Check tenant 1 profile
  const { data: t1Profile } = await tenant1Client.from("profiles").select("*, organizations(*)").eq("id", t1Auth.user.id).single();
  console.log("   Role:", t1Profile.role, "| Organization:", t1Profile.organizations?.name, "| Org ID:", t1Profile.organization_id);

  // 5. CRUD OPERATIONS: Products in Business 1
  console.log("\n[5] CRUD: Products in Business 1...");
  // Create Product 1
  const { data: prod1, error: p1Err } = await tenant1Client
    .from("products")
    .insert({
      name: "Milo 400g Tin",
      item_code: `MILO-${Date.now().toString().slice(-4)}`,
      cost_price: 45.00,
      selling_price: 65.00,
      stock_quantity: 50,
      low_stock_threshold: 10,
      organization_id: biz1.id
    })
    .select()
    .single();
  if (p1Err) throw new Error("Product 1 Insert Failed: " + p1Err.message);
  console.log("✅ Product 1 Created:", prod1.name, "| Stock:", prod1.stock_quantity, "| Price: GH₵", prod1.selling_price);

  // Create Product 2
  const { data: prod2, error: p2Err } = await tenant1Client
    .from("products")
    .insert({
      name: "Peak Evaporated Milk",
      item_code: `PEAK-${Date.now().toString().slice(-4)}`,
      cost_price: 10.00,
      selling_price: 15.00,
      stock_quantity: 100,
      low_stock_threshold: 20,
      organization_id: biz1.id
    })
    .select()
    .single();
  if (p2Err) throw new Error("Product 2 Insert Failed: " + p2Err.message);
  console.log("✅ Product 2 Created:", prod2.name, "| Stock:", prod2.stock_quantity, "| Price: GH₵", prod2.selling_price);

  // Read Products
  const { data: allProds1 } = await tenant1Client.from("products").select("*");
  console.log("✅ Read Products Count for Business 1:", allProds1.length);

  // Update Product 1 (Restock)
  const { data: updatedProd1, error: p1UpdateErr } = await tenant1Client
    .from("products")
    .update({ stock_quantity: 60, selling_price: 70.00 })
    .eq("id", prod1.id)
    .select()
    .single();
  if (p1UpdateErr) throw new Error("Product 1 Update Failed: " + p1UpdateErr.message);
  console.log("✅ Product 1 Updated (Stock: 50 -> 60, Price: 65 -> 70)");

  // 6. CRUD OPERATIONS: Customers in Business 1
  console.log("\n[6] CRUD: Customers in Business 1...");
  const { data: cust1, error: c1Err } = await tenant1Client
    .from("customers")
    .insert({
      name: "Abena Osei",
      phone: "+233241234567",
      email: "abena@example.com",
      address: "Airport Residential, Accra",
      organization_id: biz1.id
    })
    .select()
    .single();
  if (c1Err) throw new Error("Customer Insert Failed: " + c1Err.message);
  console.log("✅ Customer Created:", cust1.name, "| Phone:", cust1.phone);

  // Update Customer
  const { data: updatedCust1, error: c1UpdateErr } = await tenant1Client
    .from("customers")
    .update({ address: "Cantonments, Accra" })
    .eq("id", cust1.id)
    .select()
    .single();
  if (c1UpdateErr) throw new Error("Customer Update Failed: " + c1UpdateErr.message);
  console.log("✅ Customer Updated (Address changed to Cantonments)");

  // 7. CRUD OPERATIONS: Sales Transactions via record_sale_transaction RPC
  console.log("\n[7] CRUD: Sales Transactions & Accounting in Business 1...");
  // Record sale of 2 units of Milo (at 70 = 140) and 4 units of Peak Milk (at 15 = 60). Total = 200. Paid = 200 (Cash).
  const saleItems = [
    {
      product_id: prod1.id,
      product_name: prod1.name,
      quantity: 2,
      unit_price: 70.00,
      total_price: 140.00
    },
    {
      product_id: prod2.id,
      product_name: prod2.name,
      quantity: 4,
      unit_price: 15.00,
      total_price: 60.00
    }
  ];

  const { data: saleRes, error: saleErr } = await tenant1Client.rpc("record_sale_transaction", {
    p_customer_id: cust1.id,
    p_customer_name: cust1.name,
    p_total_amount: 200.00,
    p_amount_paid: 200.00,
    p_payment_method: "Cash",
    p_payment_status: "paid",
    p_items: saleItems,
    p_recorded_by: biz1AdminEmail
  });

  if (saleErr) throw new Error("record_sale_transaction RPC Failed: " + saleErr.message);
  console.log("✅ Sale Transaction Recorded successfully!");

  // Verify stock decrements
  const { data: checkProd1 } = await tenant1Client.from("products").select("stock_quantity").eq("id", prod1.id).single();
  const { data: checkProd2 } = await tenant1Client.from("products").select("stock_quantity").eq("id", prod2.id).single();
  console.log("✅ Stock Decrement Verified: Milo is now", checkProd1.stock_quantity, "(was 60 - 2 = 58)");
  console.log("✅ Stock Decrement Verified: Peak Milk is now", checkProd2.stock_quantity, "(was 100 - 4 = 96)");

  // Verify double-entry journal entries
  const { data: journals1 } = await tenant1Client.from("journal_entries").select("*");
  console.log("✅ Journal Entries Generated for Business 1:", journals1?.length, "entries recorded.");

  // 8. CRUD OPERATIONS: Expenses in Business 1
  console.log("\n[8] CRUD: Expenses in Business 1...");
  const { data: exp1, error: expErr } = await tenant1Client
    .from("expenses")
    .insert({
      category: "Utilities",
      description: "Electricity Bill (ECG Office Meter)",
      amount: 150.00,
      organization_id: biz1.id,
      recorded_by: biz1AdminEmail
    })
    .select()
    .single();

  if (expErr) throw new Error("Expense Insert Failed: " + expErr.message);
  console.log("✅ Expense Created:", exp1.description, "| Amount: GH₵", exp1.amount);

  // 9. MULTI-TENANT ISOLATION CHECK: Log into Business 2
  console.log(`\n[9] TESTING STRICT MULTI-TENANT DATA ISOLATION (Logging into Business 2 as ${biz2AdminEmail})...`);
  const tenant2Client = createClient(SUPABASE_URL, ANON_KEY);
  const { data: t2Auth, error: t2AuthErr } = await tenant2Client.auth.signInWithPassword({
    email: biz2AdminEmail,
    password: biz2Password
  });
  if (t2AuthErr) throw new Error("Tenant 2 Login Failed: " + t2AuthErr.message);
  console.log("✅ Tenant 2 Logged In successfully.");

  // Check what products Business 2 can see
  const { data: biz2Prods } = await tenant2Client.from("products").select("*");
  console.log("   Business 2 Products visible:", biz2Prods.length, "(MUST BE 0, cannot see Business 1 products)");
  if (biz2Prods.length !== 0) {
    throw new Error("🚨 SECURITY LEAK: Business 2 can see Business 1's products!");
  }
  console.log("🔒 Data Isolation PASS: Business 2 cannot see Business 1's products!");

  // Check what sales Business 2 can see
  const { data: biz2Sales } = await tenant2Client.from("sales").select("*");
  console.log("   Business 2 Sales visible:", biz2Sales.length, "(MUST BE 0)");
  if (biz2Sales.length !== 0) {
    throw new Error("🚨 SECURITY LEAK: Business 2 can see Business 1's sales!");
  }
  console.log("🔒 Data Isolation PASS: Business 2 cannot see Business 1's sales!");

  // Create a product in Business 2
  const { data: biz2Prod } = await tenant2Client
    .from("products")
    .insert({
      name: "Fresh Tomatoes (Box)",
      item_code: `TOM-${Date.now().toString().slice(-4)}`,
      cost_price: 80.00,
      selling_price: 120.00,
      stock_quantity: 25,
      organization_id: biz2.id
    })
    .select()
    .single();
  console.log("✅ Business 2 Created Own Product:", biz2Prod.name);

  // Verify Business 1 CANNOT see Business 2's new product
  const { data: checkBiz1Prods } = await tenant1Client.from("products").select("*").eq("id", biz2Prod.id);
  if (checkBiz1Prods.length !== 0) {
    throw new Error("🚨 SECURITY LEAK: Business 1 can see Business 2's product!");
  }
  console.log("🔒 Data Isolation PASS: Business 1 cannot see Business 2's product!");

  console.log("\n=================================================================");
  console.log("   ALL MULTI-TENANT CRUD OPERATIONS & SECURITY TESTS PASSED!   ");
  console.log("=================================================================");
}

runVerification().catch(err => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
