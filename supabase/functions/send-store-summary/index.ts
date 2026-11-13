// supabase/functions/send-store-summary/index.ts
//
// Dispatches automated daily and weekly sales digests to store admins.
// Timings:
//   - Daily Summary: Every day at 6:00 PM UTC (skips stores with 0 transactions)
//   - Weekly Executive Summary: Every Saturday at 6:00 PM UTC
//
// Triggered by:
//   1. pg_cron HTTP POST triggers (automated daily & weekly runs)
//   2. Admin manual test preview from Admin Settings ("Send Test Summary")

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../_shared/resend.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body
    }

    const frequency = (body.frequency || 'daily').toLowerCase(); // 'daily' or 'weekly'
    const targetOrgId = body.org_id;
    const isTest = Boolean(body.is_test);

    console.log(`[Summary Dispatcher] Frequency: ${frequency}, Org: ${targetOrgId || 'ALL'}, Test: ${isTest}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch target organizations
    let orgQuery = supabase.from('organizations').select('*');
    if (targetOrgId) {
      orgQuery = orgQuery.eq('id', targetOrgId);
    } else {
      orgQuery = orgQuery.eq('is_active', true);
    }

    const { data: orgs, error: orgErr } = await orgQuery;
    if (orgErr) throw orgErr;
    if (!orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ message: 'No organizations found to process', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const results: any[] = [];
    const now = new Date();

    for (const org of orgs) {
      const notifSettings = org.notification_settings || {};
      const primaryColor = org.primary_color || '#f15a24';
      const currency = org.currency || 'GHS';

      // 1. Check opt-in preferences (unless manual test preview)
      if (!isTest) {
        if (frequency === 'daily' && notifSettings.daily_summary?.enabled === false) {
          console.log(`Skipping daily digest for ${org.name} (opted out)`);
          continue;
        }
        if (frequency === 'weekly' && notifSettings.weekly_summary?.enabled === false) {
          console.log(`Skipping weekly digest for ${org.name} (opted out)`);
          continue;
        }
      }

      // 2. Resolve recipient email list
      const recipients = new Set<string>();
      if (org.admin_email) recipients.add(org.admin_email.trim().toLowerCase());

      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('email')
        .eq('organization_id', org.id)
        .eq('role', 'admin');

      (adminProfiles || []).forEach(p => {
        if (p.email) recipients.add(p.email.trim().toLowerCase());
      });

      if (Array.isArray(notifSettings.recipients)) {
        notifSettings.recipients.forEach((em: string) => {
          if (em && typeof em === 'string') recipients.add(em.trim().toLowerCase());
        });
      }

      const recipientList = Array.from(recipients).filter(Boolean);
      if (recipientList.length === 0) {
        console.warn(`No valid recipient emails for ${org.name} — skipping.`);
        continue;
      }

      // 3. Define time window
      let windowStart: Date;
      let windowLabel = '';

      if (frequency === 'weekly') {
        // Last 7 days
        windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        windowLabel = 'Past 7 Days';
      } else {
        // Daily: Start of today (00:00:00 UTC)
        windowStart = new Date(now);
        windowStart.setUTCHours(0, 0, 0, 0);
        windowLabel = 'Today';
      }

      // 4. Fetch sales within window
      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select(`
          id, invoice_no, total_amount, amount_paid, balance_due,
          payment_method, payment_status, created_at, customer_name,
          sale_items ( product_name, quantity, unit_price, subtotal )
        `)
        .eq('organization_id', org.id)
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: false });

      if (salesErr) {
        console.error(`Sales query error for ${org.name}:`, salesErr.message);
        continue;
      }

      const salesList = sales || [];

      // 5. CRITICAL USER RULE:
      // "If a store records zero transactions on a particular day, then do not send anything."
      if (salesList.length === 0 && !isTest) {
        console.log(`[Zero-Sales Rule] ${org.name} had 0 transactions ${windowLabel.toLowerCase()}. Skipping email.`);
        results.push({ org: org.name, status: 'skipped_zero_transactions' });
        continue;
      }

      // 6. Aggregate Sales & Payment Metrics
      let totalRevenue = 0;
      let totalCashCollected = 0;
      let totalOutstandingCredit = 0;
      const paymentBreakdown: Record<string, number> = {
        Cash: 0,
        'Mobile Money': 0,
        Card: 0,
        Deposit: 0,
        Other: 0
      };

      const productAggregation: Record<string, { qty: number; revenue: number }> = {};

      salesList.forEach((s: any) => {
        const rev = parseFloat(s.total_amount) || 0;
        const paid = parseFloat(s.amount_paid) || 0;
        const due = parseFloat(s.balance_due) || 0;

        totalRevenue += rev;
        totalCashCollected += paid;
        totalOutstandingCredit += due;

        const method = (s.payment_method || 'Cash').toLowerCase();
        if (method.includes('momo') || method.includes('mobile')) {
          paymentBreakdown['Mobile Money'] += paid;
        } else if (method.includes('card') || method.includes('pos')) {
          paymentBreakdown['Card'] += paid;
        } else if (method.includes('deposit')) {
          paymentBreakdown['Deposit'] += paid;
        } else if (method.includes('cash')) {
          paymentBreakdown['Cash'] += paid;
        } else {
          paymentBreakdown['Other'] += paid;
        }

        // Aggregate line items
        if (Array.isArray(s.sale_items)) {
          s.sale_items.forEach((item: any) => {
            const name = item.product_name || 'Item';
            const q = parseFloat(item.quantity) || 1;
            const sub = parseFloat(item.subtotal) || 0;
            if (!productAggregation[name]) {
              productAggregation[name] = { qty: 0, revenue: 0 };
            }
            productAggregation[name].qty += q;
            productAggregation[name].revenue += sub;
          });
        }
      });

      const topProducts = Object.entries(productAggregation)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, frequency === 'weekly' ? 5 : 3);

      // 7. Extra metrics for Weekly Executive Summary
      let weeklyExpenses = 0;
      let priorWeekRevenue = 0;
      let stockValuation = 0;
      let lowStockCount = 0;

      if (frequency === 'weekly' || isTest) {
        // Fetch weekly expenses
        const { data: expData } = await supabase
          .from('expenses')
          .select('amount')
          .eq('organization_id', org.id)
          .gte('created_at', windowStart.toISOString());

        weeklyExpenses = (expData || []).reduce((acc: number, e: any) => acc + (parseFloat(e.amount) || 0), 0);

        // Fetch prior 7-day sales for comparison
        const priorStart = new Date(windowStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        const { data: priorSales } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('organization_id', org.id)
          .gte('created_at', priorStart.toISOString())
          .lt('created_at', windowStart.toISOString());

        priorWeekRevenue = (priorSales || []).reduce((acc: number, s: any) => acc + (parseFloat(s.total_amount) || 0), 0);

        // Fetch current live inventory
        const { data: prodData } = await supabase
          .from('products')
          .select('stock_quantity, selling_price, low_stock_threshold')
          .eq('organization_id', org.id);

        (prodData || []).forEach((p: any) => {
          const qty = Math.max(0, parseFloat(p.stock_quantity) || 0);
          const price = parseFloat(p.selling_price) || 0;
          stockValuation += qty * price;
          if (qty < (p.low_stock_threshold || 10)) {
            lowStockCount++;
          }
        });
      }

      const growthPct = priorWeekRevenue > 0
        ? (((totalRevenue - priorWeekRevenue) / priorWeekRevenue) * 100).toFixed(1)
        : null;

      const dateStr = now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      // 8. Build Branded HTML Template
      const isWeekly = frequency === 'weekly';
      const subjectTitle = isWeekly
        ? `[StoreFlow] 📈 Weekly Executive Report: ${org.name} (Saturday 6 PM)`
        : `[StoreFlow] 📊 Daily Sales Digest: ${org.name} (${currency} ${totalRevenue.toLocaleString()})`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { background: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: ${primaryColor}; padding: 28px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
    .header p { margin: 6px 0 0; opacity: 0.9; font-size: 13px; }
    .content { padding: 28px 32px; }
    .kpi-banner { background: #f8fafc; border-radius: 12px; padding: 20px; border: 1.5px solid #e2e8f0; margin-bottom: 24px; text-align: center; }
    .kpi-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    .kpi-value { font-size: 34px; font-weight: 800; color: #0f172a; margin: 6px 0; }
    .kpi-sub { font-size: 13px; color: #059669; font-weight: 600; }
    .stats-row { display: flex; gap: 12px; margin-bottom: 24px; }
    .stat-pill { flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
    .stat-pill-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .stat-pill-val { font-size: 18px; font-weight: 700; color: #1e293b; margin-top: 4px; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.04em; margin-bottom: 12px; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    .table th { text-align: left; padding: 10px 12px; background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
    .table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11.5px; color: #94a3b8; }
    .btn { display: inline-block; background: ${primaryColor}; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 13.5px; margin-top: 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #dcfce7; color: #15803d; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>${org.name}</h1>
          <p>${isWeekly ? 'Weekly Executive Performance Report' : 'Daily Sales & Cash Digest'} • ${dateStr}</p>
        </div>
        ${isTest ? '<span style="background: rgba(255,255,255,0.25); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800;">TEST PREVIEW</span>' : ''}
      </div>
    </div>

    <div class="content">
      <!-- Hero Metric -->
      <div class="kpi-banner">
        <div class="kpi-label">${isWeekly ? 'Total Weekly Gross Sales' : 'Today\'s Total Gross Sales'}</div>
        <div class="kpi-value">${currency} ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="kpi-sub">
          ${salesList.length} transaction${salesList.length === 1 ? '' : 's'} recorded
          ${growthPct !== null ? `• <span class="badge">${parseFloat(growthPct) >= 0 ? '+' : ''}${growthPct}% vs prior week</span>` : ''}
        </div>
      </div>

      <!-- Quick Stats Pills -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 20px;">
        <tr>
          <td class="stat-pill">
            <div class="stat-pill-label">Cash Collected</div>
            <div class="stat-pill-val" style="color: #059669;">${currency} ${totalCashCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </td>
          <td class="stat-pill">
            <div class="stat-pill-label">New Customer Debt</div>
            <div class="stat-pill-val" style="color: ${totalOutstandingCredit > 0 ? '#dc2626' : '#64748b'};">${currency} ${totalOutstandingCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </td>
          ${isWeekly ? `
          <td class="stat-pill">
            <div class="stat-pill-label">Live Stock Valuation</div>
            <div class="stat-pill-val" style="color: #2563eb;">${currency} ${stockValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </td>
          ` : `
          <td class="stat-pill">
            <div class="stat-pill-label">Receipts Audited</div>
            <div class="stat-pill-val">${salesList.length}</div>
          </td>
          `}
        </tr>
      </table>

      <!-- Payment Channel Breakdown -->
      <div class="section-title">Payment Method Breakdown</div>
      <table class="table">
        <thead>
          <tr>
            <th>Channel</th>
            <th style="text-align: right;">Amount Collected</th>
          </tr>
        </thead>
        <tbody>
          ${paymentBreakdown['Cash'] > 0 ? `<tr><td>💵 Cash in Drawer</td><td style="text-align: right; font-weight: 700;">${currency} ${paymentBreakdown['Cash'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ''}
          ${paymentBreakdown['Mobile Money'] > 0 ? `<tr><td>📱 Mobile Money (MoMo)</td><td style="text-align: right; font-weight: 700;">${currency} ${paymentBreakdown['Mobile Money'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ''}
          ${paymentBreakdown['Card'] > 0 ? `<tr><td>💳 Card / POS Terminal</td><td style="text-align: right; font-weight: 700;">${currency} ${paymentBreakdown['Card'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ''}
          ${paymentBreakdown['Deposit'] > 0 ? `<tr><td>📑 Customer Advance Deposit</td><td style="text-align: right; font-weight: 700;">${currency} ${paymentBreakdown['Deposit'].toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ''}
          <tr>
            <td style="font-weight: 700; color: #0f172a;">Total Realized Payments</td>
            <td style="text-align: right; font-weight: 800; color: #059669;">${currency} ${totalCashCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <!-- Top Selling Products -->
      ${topProducts.length > 0 ? `
      <div class="section-title">Top Selling Products (${windowLabel})</div>
      <table class="table">
        <thead>
          <tr>
            <th>Product</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${topProducts.map(([name, data]) => `
            <tr>
              <td style="font-weight: 600;">${name}</td>
              <td style="text-align: center; color: #64748b;">${data.qty}</td>
              <td style="text-align: right; font-weight: 700;">${currency} ${data.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ` : ''}

      <!-- Weekly Profit Snapshot -->
      ${isWeekly ? `
      <div class="section-title">Weekly Financial Health</div>
      <div style="background: #f1f5f9; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span>Weekly Gross Revenue:</span>
          <strong>${currency} ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #dc2626;">
          <span>Recorded Store Expenses:</span>
          <strong>- ${currency} ${weeklyExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 14px; font-weight: 800; color: #059669;">
          <span>Net Operating Cashflow:</span>
          <span>${currency} ${(totalRevenue - weeklyExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        ${lowStockCount > 0 ? `
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #d97706; font-weight: 600;">
          ⚠️ ${lowStockCount} item${lowStockCount === 1 ? '' : 's'} are below low-stock reorder thresholds.
        </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- CTA Button -->
      <div style="text-align: center; margin: 28px 0 10px;">
        <a href="https://storeflow.bookflywheel.com/dashboard" class="btn">Open StoreFlow Dashboard</a>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px;">StoreFlow by Flywheel Technologies • Cloud POS & Multi-Tenant Inventory Control</p>
      <p style="margin: 0;">You received this email because automated ${frequency} digests are enabled for ${org.name}. Manage preferences in <strong>Admin Settings → Notifications</strong>.</p>
    </div>
  </div>
</body>
</html>
      `;

      // 9. Dispatch to recipients via Resend
      for (const toEmail of recipientList) {
        try {
          await sendEmail({
            to: toEmail,
            subject: subjectTitle,
            html: htmlContent,
            fromName: `${org.name} on StoreFlow`,
          });
          console.log(`Dispatched ${frequency} digest for ${org.name} to ${toEmail}`);
        } catch (emailErr: any) {
          console.error(`Email send error for ${org.name} to ${toEmail}:`, emailErr.message);
        }
      }

      results.push({
        org: org.name,
        frequency,
        recipients: recipientList,
        salesCount: salesList.length,
        revenue: totalRevenue,
        status: 'sent'
      });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('send-store-summary error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

