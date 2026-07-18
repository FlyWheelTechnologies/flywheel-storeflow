// supabase/functions/notify-deposit/index.ts
//
// Triggered by a Supabase Database Webhook on:
//   Table: public.sales
//   Events: INSERT
//   Filter: payment_status=eq.DEPOSIT   ← set in webhook config
//
// Webhook setup (Supabase Dashboard → Database → Webhooks):
//   Name: on_deposit_created
//   Table: sales
//   Events: INSERT
//   URL: https://<your-project>.supabase.co/functions/v1/notify-deposit
//   Headers: Authorization: Bearer <your-service-role-key>
//
// This notifies admins when a new deposit order comes in,
// so they can prepare the order for fulfillment.

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../_shared/resend.ts';

Deno.serve(async (req: Request) => {
  try {
    const { record } = await req.json();

    // Only process DEPOSIT payment status
    if (record?.payment_status !== 'DEPOSIT') {
      return new Response('Not a deposit — skipping', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get sale items for this deposit
    const { data: saleItems } = await supabase
      .from('sale_items')
      .select('product_name, quantity, unit_price, subtotal')
      .eq('sale_id', record.id);

    // Get all admins to notify
    const { data: admins } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('role', 'admin');

    if (!admins || admins.length === 0) {
      return new Response('No admins to notify', { status: 200 });
    }

    type SaleItem = { product_name: string; quantity: number; unit_price: number; subtotal: number };
    const itemsHtml = saleItems && saleItems.length > 0
      ? (saleItems as SaleItem[]).map((i: SaleItem) => `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6;">${i.product_name}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: center;">${i.quantity}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right;">GHS ${Number(i.unit_price).toFixed(2)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">GHS ${Number(i.subtotal).toFixed(2)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #9ca3af;">No items listed</td></tr>';

    const html = `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 28px; text-align: center;">
          <p style="color: #bfdbfe; font-size: 28px; margin: 0;">📥</p>
          <h1 style="color: #fff; margin: 8px 0 0; font-size: 20px;">New Deposit Order</h1>
          <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 13px;">Flywheel IMS — Action Required</p>
        </div>

        <!-- Body -->
        <div style="padding: 28px;">
          <p style="font-size: 15px; color: #374151;">A new deposit order has been placed and requires fulfillment:</p>

          <!-- Order Summary -->
          <div style="background: #eff6ff; border-radius: 10px; padding: 20px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Order Ref</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right; font-family: monospace;">#${record.id.slice(0, 8).toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Customer</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${record.customer_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Order Total</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">GHS ${Number(record.total_amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #059669; font-weight: 600;">Deposit Received</td>
                <td style="padding: 8px 0; font-weight: 700; text-align: right; color: #059669;">GHS ${Number(record.amount_paid).toFixed(2)}</td>
              </tr>
              <tr style="border-top: 1px solid #bfdbfe;">
                <td style="padding: 10px 0; color: #1e40af; font-weight: 600;">Balance on Delivery</td>
                <td style="padding: 10px 0; font-weight: 700; text-align: right; color: #1e40af;">GHS ${Number(record.balance_due).toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <!-- Items Table -->
          ${saleItems && saleItems.length > 0 ? `
          <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px;">Items to Prepare</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #6b7280;">Item</th>
                <th style="padding: 10px 12px; text-align: center; font-weight: 600; color: #6b7280;">Qty</th>
                <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #6b7280;">Unit Price</th>
                <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #6b7280;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          ` : ''}

          ${record.notes ? `
          <div style="background: #f9fafb; border-radius: 8px; padding: 14px; margin-top: 16px; font-size: 13px; color: #374151;">
            <strong>Notes:</strong> ${record.notes}
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 24px;">
            <a href="${Deno.env.get('APP_URL') ?? '#'}/debtors"
               style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              View Deposits →
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 28px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">Automated notification from Flywheel IMS</p>
        </div>
      </div>
    `;

    for (const admin of admins) {
      if (admin.email) {
        await sendEmail({
          to: admin.email,
          subject: `📥 New Deposit: ${record.customer_name} — GHS ${Number(record.total_amount).toFixed(2)}`,
          html,
        });
      }
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-deposit error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
