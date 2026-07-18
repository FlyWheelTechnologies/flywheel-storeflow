// supabase/functions/send-receipt/index.ts
//
// Triggered by a Supabase Database Webhook on:
//   Table: public.sales
//   Events: INSERT
//
// Webhook setup (Supabase Dashboard → Database → Webhooks):
//   Name: on_sale_created
//   Table: sales
//   Events: INSERT
//   URL: https://<your-project>.supabase.co/functions/v1/send-receipt
//   Headers: Authorization: Bearer <your-service-role-key>

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../_shared/resend.ts';

Deno.serve(async (req: Request) => {
  try {
    // Supabase webhooks send a POST with the record payload
    const payload = await req.json();
    const { record, type } = payload;

    console.log(`Webhook triggered with event type: ${type} for sale ${record?.id}`);

    // Only send receipt on INSERT
    if (type && type !== 'INSERT') {
      return new Response(`Ignoring ${type} event`, { status: 200 });
    }

    // Use service role to read customer data (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let customer = { name: 'Walk-in Customer', email: null };
    if (record?.customer_id) {
      const { data, error } = await supabase
        .from('customers')
        .select('name, email')
        .eq('id', record.customer_id)
        .single();

      if (error) {
        console.error('Error fetching customer:', error);
        return new Response(`Error fetching customer: ${error.message}`, { status: 500 });
      }
      customer = data;
    }

    // Fetch sale items
    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', record.id);

    if (itemsError) {
      console.error('Error fetching sale items:', itemsError);
      return new Response(`Error fetching sale items: ${itemsError.message}`, { status: 500 });
    }

    const toEmail = customer?.email;
    
    // Fetch organization details for branding
    let orgName = 'StoreFlow';
    let primaryColor = '#f97316';
    let currency = 'GHS';
    let adminEmail = 'godwinokro2020@gmail.com';

    if (record.organization_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, primary_color, currency, admin_email')
        .eq('id', record.organization_id)
        .single();
      
      if (orgData) {
        orgName = orgData.name;
        primaryColor = orgData.primary_color || primaryColor;
        currency = orgData.currency || currency;
        adminEmail = orgData.admin_email || adminEmail;
      }
    }

    if (!toEmail) {
      console.log(`Customer has no email — will send to admin (${adminEmail}) only`);
    }

    const isDeposit = record.payment_status === 'DEPOSIT';
    
    let amountPaidDisplay = Number(record.amount_paid);
    let balanceDueDisplay = Number(record.balance_due);
    let changeDisplay = 0;

    const changeString = `Change given: ${currency}`;
    if (record.notes && record.notes.includes(changeString)) {
      const match = record.notes.match(new RegExp(`Change given: ${currency} ([\\d.]+)`));
      if (match) {
        changeDisplay = parseFloat(match[1]);
        amountPaidDisplay = Number(record.total_amount) + changeDisplay;
        balanceDueDisplay = 0;
      }
    }

    const statusColorMap: Record<string, string> = {
      PAID: '#059669',
      PARTIAL: '#f59e0b',
      DEPOSIT: '#3b82f6',
      UNPAID: '#ef4444',
    };
    const statusColor = statusColorMap[record.payment_status] ?? '#6b7280';

    const html = `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #374151 0%, #1f2937 100%); padding: 32px 28px; text-align: center;">
          <h1 style="color: ${primaryColor}; margin: 0; font-size: 22px; letter-spacing: -0.5px;">${orgName}</h1>
          <p style="color: #94a3b8; margin: 6px 0 0; font-size: 13px;">${isDeposit ? 'Deposit Confirmation' : 'Sale Receipt'}</p>
        </div>

        <!-- Body -->
        <div style="padding: 28px;">
          <p style="font-size: 15px; color: #374151;">Hi <strong>${customer.name}</strong>,</p>
          <p style="font-size: 14px; color: #6b7280;">
            ${isDeposit
              ? 'Thank you for your advance deposit. We\'ll fulfill your order shortly.'
              : 'Thank you for your purchase. Here is your receipt.'}
          </p>

          <!-- Items Section -->
          <div style="margin: 20px 0;">
            <h3 style="font-size: 15px; color: #374151; margin-bottom: 10px;">Items Purchased</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <th style="text-align: left; padding: 8px 0; color: #6b7280;">Item</th>
                  <th style="text-align: center; padding: 8px 0; color: #6b7280;">Qty</th>
                  <th style="text-align: right; padding: 8px 0; color: #6b7280;">Price</th>
                  <th style="text-align: right; padding: 8px 0; color: #6b7280;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${saleItems?.map(item => `
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 8px 0; color: #374151;">${item.product_name}</td>
                    <td style="padding: 8px 0; color: #374151; text-align: center;">${item.quantity}</td>
                    <td style="padding: 8px 0; color: #374151; text-align: right;">${currency} ${Number(item.unit_price).toFixed(2)}</td>
                    <td style="padding: 8px 0; color: #374151; text-align: right; font-weight: 600;">${currency} ${Number(item.subtotal).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Summary Box -->
          <div style="background: #f9fafb; border-radius: 10px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Reference</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; font-family: monospace;">#${record.id.slice(0, 8).toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Date</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${new Date(record.created_at).toLocaleDateString('en-GH', { dateStyle: 'long' })}</td>
              </tr>
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="padding: 12px 0; font-size: 16px; font-weight: 700;">Total</td>
                <td style="padding: 12px 0; font-size: 16px; font-weight: 700; text-align: right;">${currency} ${Number(record.total_amount).toFixed(2)}</td>
              </tr>
              ${record.tax_amount > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 12px;">Includes ${record.tax_percentage}% Tax</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #6b7280; font-size: 12px;">${currency} ${Number(record.tax_amount).toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">${isDeposit ? 'Deposit Paid' : (changeDisplay > 0 ? 'Amount Tendered' : 'Amount Paid')}</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #059669;">${currency} ${amountPaidDisplay.toFixed(2)}</td>
              </tr>
              ${changeDisplay > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Change</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; color: #059669;">${currency} ${changeDisplay.toFixed(2)}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- Status Badge -->
          <div style="text-align: center; margin: 20px 0;">
            <span style="display: inline-block; background: ${statusColor}; color: #fff; padding: 6px 20px; border-radius: 20px; font-size: 13px; font-weight: 700; letter-spacing: 1px;">
              ${record.payment_status}
            </span>
          </div>

          ${isDeposit ? `
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 13px; color: #1e40af;">
            <strong>Deposit Note:</strong> Your payment of ${currency} ${Number(record.amount_paid).toFixed(2)} has been received and is held as an advance deposit. The remaining ${currency} ${Number(record.balance_due).toFixed(2)} is due on delivery.
          </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 20px 28px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">Questions? Contact your store admin.</p>
          <p style="font-size: 11px; color: #d1d5db; margin: 4px 0 0;">Powered by StoreFlow by Flywheel</p>
        </div>
      </div>
    `;

    const shouldBcc = toEmail && toEmail !== adminEmail;

    await sendEmail({
      to: toEmail || adminEmail,
      fromName: orgName,
      subject: isDeposit
        ? `Deposit Confirmation #${record.id.slice(0, 8).toUpperCase()} — ${orgName}`
        : `Receipt #${record.id.slice(0, 8).toUpperCase()} — ${orgName}`,
      html,
      bcc: shouldBcc ? adminEmail : undefined,
    });

    return new Response(JSON.stringify({ sent: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-receipt error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
