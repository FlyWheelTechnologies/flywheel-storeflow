import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const to = body.to;
    const scenario = body.scenario || 'receipt'; // 'receipt' | 'low_stock' | 'invite' | 'generic'
    const businessName = body.businessName || 'Flywheel Tech Mart';
    const primaryColor = body.primaryColor || '#f97316';
    const currency = body.currency || 'GHS';

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter 'to' (destination email)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject = "";
    let html = "";

    if (scenario === 'receipt') {
      subject = `Receipt #INV-84920 — ${businessName}`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 28px; text-align: center;">
            <h1 style="color: ${primaryColor}; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${businessName}</h1>
            <p style="color: #94a3b8; margin: 6px 0 0; font-size: 13px;">Official Sales Receipt</p>
          </div>
          <div style="padding: 28px;">
            <p style="font-size: 15px; color: #334155; margin-top: 0;">Hi <strong>Valued Customer</strong>,</p>
            <p style="font-size: 14px; color: #64748b; line-height: 1.5;">Thank you for shopping with ${businessName}. Here is your itemized transaction receipt:</p>
            
            <div style="background: #f8fafc; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b;">
                <span>Invoice Number:</span> <strong style="color: #1e293b;">#INV-84920</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b;">
                <span>Date:</span> <strong style="color: #1e293b;">${new Date().toLocaleDateString('en-GB')}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #64748b;">
                <span>Payment Method:</span> <strong style="color: #1e293b;">Cash / Mobile Money</strong>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px;">
              <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b; text-align: left;">
                  <th style="padding: 10px 0;">Item</th>
                  <th style="padding: 10px 0; text-align: center;">Qty</th>
                  <th style="padding: 10px 0; text-align: right;">Unit Price</th>
                  <th style="padding: 10px 0; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #f1f5f9; color: #334155;">
                  <td style="padding: 12px 0;"><strong>Wireless Fast Charger 15W</strong></td>
                  <td style="padding: 12px 0; text-align: center;">2</td>
                  <td style="padding: 12px 0; text-align: right;">${currency} 120.00</td>
                  <td style="padding: 12px 0; text-align: right; font-weight: 600;">${currency} 240.00</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; color: #334155;">
                  <td style="padding: 12px 0;"><strong>Braided Type-C Cable 2M</strong></td>
                  <td style="padding: 12px 0; text-align: center;">1</td>
                  <td style="padding: 12px 0; text-align: right;">${currency} 45.00</td>
                  <td style="padding: 12px 0; text-align: right; font-weight: 600;">${currency} 45.00</td>
                </tr>
              </tbody>
            </table>

            <div style="text-align: right; padding-top: 12px; border-top: 2px solid #e2e8f0;">
              <span style="font-size: 14px; color: #64748b; margin-right: 16px;">Total Paid:</span>
              <strong style="font-size: 22px; color: #059669;">${currency} 285.00</strong>
            </div>

            <div style="text-align: center; margin: 24px 0 10px;">
              <span style="display: inline-block; background: #059669; color: #fff; padding: 6px 20px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">PAID IN FULL</span>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 12px; color: #64748b; margin: 0;">Need support? Reply directly to your store admin.</p>
            <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">StoreFlow Cloud Retail Management</p>
          </div>
        </div>
      `;
    } else if (scenario === 'low_stock') {
      subject = `⚠️ URGENT: Low Stock Alert — ${businessName}`;
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: #ea580c; padding: 24px 28px; text-align: center;">
            <p style="color: #fff; font-size: 32px; margin: 0;">⚠️</p>
            <h1 style="color: #fff; margin: 6px 0 0; font-size: 20px; font-weight: 700;">LOW INVENTORY ALERT</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 13px;">${businessName} Store Notification</p>
          </div>
          <div style="padding: 28px;">
            <p style="font-size: 15px; color: #334155; margin-top: 0;">Hi Admin,</p>
            <p style="font-size: 14px; color: #64748b; line-height: 1.5;">The following product has dropped below your configured replenishment threshold:</p>
            
            <div style="background: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0;">
              <h3 style="margin: 0 0 6px 0; color: #9a3412; font-size: 16px;">Wireless Fast Charger 15W</h3>
              <p style="margin: 0; font-size: 14px; color: #c2410c;">
                <strong>Current Stock:</strong> 2 units remaining &nbsp;|&nbsp; <strong>Threshold:</strong> 10 units
              </p>
            </div>
            <p style="font-size: 13px; color: #64748b;">Please reorder or adjust inventory levels to avoid stockouts during checkout.</p>
          </div>
          <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">StoreFlow Automated Inventory Monitor</p>
          </div>
        </div>
      `;
    }

    console.log(`Sending [${scenario}] email to: ${to} for business: ${businessName}`);

    await sendEmail({
      to,
      subject,
      html,
      fromName: businessName
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        scenario,
        businessName,
        recipient: to,
        message: `Successfully sent ${scenario} email to ${to} branded for ${businessName}` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Test email error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
