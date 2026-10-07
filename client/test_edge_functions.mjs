const SUPABASE_URL = "https://ongyutrabagetgdebdib.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZ3l1dHJhYmFnZXRnZGViZGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzkzNjAsImV4cCI6MjA5OTk1NTM2MH0.IfQRIkgcUq0H4biVcf6Sc-gBhlOP04wyN32OWd357OQ";

async function testEdgeFunction(name, payload) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing Edge Function: [${name}]`);
  console.log(`Endpoint: ${url}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const status = res.status;
    const text = await res.text();
    console.log(`Status: ${status}`);
    console.log(`Response: ${text.slice(0, 300)}`);
    return { name, status, text };
  } catch (err) {
    console.error(`Error invoking [${name}]:`, err.message);
    return { name, status: 500, error: err.message };
  }
}

async function run() {
  console.log("==================================================");
  console.log("   StoreFlow Edge Functions Health & Email Test   ");
  console.log("==================================================");

  // 1. Test notify-deposit LIVE with full deposit record
  await testEdgeFunction("notify-deposit", {
    record: {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      invoice_no: "DEP-2026-0042",
      payment_status: "DEPOSIT",
      customer_name: "Kofi Mensah",
      total_amount: 500.00,
      amount_paid: 200.00,
      balance_due: 300.00,
      admin_email: "flywheeltechnologies2025@gmail.com"
    }
  });

  // 2. Test invite-user LIVE with valid invitation payload
  await testEdgeFunction("invite-user", {
    email: "flywheeltechnologies2025@gmail.com",
    role: "storekeeper",
    fullName: "Kwame Asare",
    password: "TempStoreFlowPassword2026!"
  });

  console.log("\n==================================================");
  console.log("   Test Execution Completed                       ");
  console.log("==================================================");
}

run();