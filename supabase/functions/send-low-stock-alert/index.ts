// supabase/functions/send-low-stock-alert/index.ts
//
// Triggered by a Supabase Database Webhook on:
//   Table: public.products
//   Events: UPDATE
//
// Webhook setup (Supabase Dashboard → Database → Webhooks):
//   Name: on_product_stock_updated
//   Table: products
//   Events: UPDATE
//   URL: https://<your-project>.supabase.co/functions/v1/send-low-stock-alert
//   Headers: Authorization: Bearer <your-service-role-key>
//
// This function fires on every product update but only sends an email
// when stock has newly dropped below the low_stock_threshold.

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../_shared/resend.ts';

Deno.serve(async (req: Request) => {
  try {
    const { record, old_record } = await req.json();

    // Only alert if stock has NEWLY dropped below threshold
    // (don't spam if it was already low before this update)
    const wasOk = old_record?.stock_quantity >= old_record?.low_stock_threshold;
    const isNowLow = record.stock_quantity < record.low_stock_threshold;

    if (!wasOk || !isNowLow) {
      return new Response('No new low-stock condition — skipping', { status: 200 });
    }

    // Get admin email(s) scoped by organization
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .eq('organization_id', record.organization_id);

    if (!admins || admins.length === 0) {
      console.log(`No admin profiles found for organization ${record.organization_id} — skipping`);
      return new Response('No admins', { status: 200 });
    }

    // Fetch organization details for branding
    let orgName = 'StoreFlow';
    if (record.organization_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', record.organization_id)
        .single();
      
      if (orgData) {
        orgName = orgData.name;
      }
    }

    const percentRemaining = Math.round((record.stock_quantity / record.low_stock_threshold) * 100);
    const urgency = record.stock_quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK';
    const urgencyColor = record.stock_quantity === 0 ? '#dc2626' : '#f59e0b';

    const html = `
      <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        
        <!-- Alert Header -->
        <div style="background: ${urgencyColor}; padding: 24px 28px; text-align: center;">
          <p style="color: #fff; font-size: 28px; margin: 0;">⚠️</p>
          <h1 style="color: #fff; margin: 8px 0 0; font-size: 20px;">${urgency} ALERT</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px;">${orgName} — Inventory Warning</p>
        </div>

        <!-- Body -->
        <div style="padding: 28px;">
          <p style="font-size: 15px; color: #374151;">Hi Admin,</p>
          <p style="font-size: 14px; color: #6b7280;">The following item requires immediate attention:</p>

          <!-- Product Card -->
          <div style="background: #fff7ed; border: 1.5px solid ${urgencyColor}; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h2 style="margin: 0 0 4px; font-size: 18px; color: #1e293b;">${record.name}</h2>
            <p style="margin: 0 0 16px; font-size: 12px; color: #9ca3af;">${record.category}</p>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Current Stock</td>
                <td style="padding: 8px 0; font-weight: 700; text-align: right; color: ${urgencyColor};">
                  ${record.stock_quantity} ${record.selling_uom}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Minimum Threshold</td>
                <td style="padding: 8px 0; font-weight: 600; text-align: right;">${record.low_stock_threshold} ${record.selling_uom}</td>
              </tr>
              <tr style="border-top: 1px solid #fed7aa;">
                <td style="padding: 10px 0; color: #6b7280;">Remaining</td>
                <td style="padding: 10px 0; font-weight: 700; text-align: right; color: ${urgencyColor};">${percentRemaining}% of minimum</td>
              </tr>
            </table>
          </div>

          <!-- Progress Bar -->
          <div style="margin: 16px 0;">
            <div style="background: #f3f4f6; border-radius: 8px; overflow: hidden; height: 10px;">
              <div style="background: ${urgencyColor}; width: ${Math.min(percentRemaining, 100)}%; height: 100%; border-radius: 8px;"></div>
            </div>
          </div>

          <div style="text-align: center; margin-top: 24px;">
            <a href="${Deno.env.get('APP_URL') ?? '#'}/products" 
               style="display: inline-block; background: #1e293b; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              View Inventory →
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 28px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">Automated alert from ${orgName}</p>
          <p style="font-size: 10px; color: #d1d5db; margin: 4px 0 0;">Powered by StoreFlow by Flywheel</p>
        </div>
      </div>
    `;

    // Send to all admins
    const appUrl = Deno.env.get('APP_URL') || 'https://ims.bookflywheel.com';
    for (const admin of admins) {
      if (admin.email) {
        await sendEmail({
          to: admin.email,
          fromName: orgName,
          subject: `${urgency}: ${record.name} — ${orgName}`,
          html,
        });
      }
    }

    return new Response(JSON.stringify({ sent: true, admins: admins.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-low-stock-alert error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
