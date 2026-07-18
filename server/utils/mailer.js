const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const data = await resend.emails.send({
      from: 'Flywheel <onboarding@resend.dev>', // Replace with your verified domain once ready
      to,
      subject,
      html: html || `<p>${text}</p>`,
    });
    return { success: true, data };
  } catch (error) {
    console.error('Resend Error:', error);
    return { success: false, error };
  }
};

const sendReceiptEmail = async (sale, customer, adminEmail) => {
  if (!customer?.email && !adminEmail) return;

  const subject = `Receipt for Sale #${sale.id} - Flywheel`;
  const customerName = customer?.name || sale.customer_name || 'Walk-in Customer';
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
      <h2 style="color: #2563eb;">Flywheel Stock Management</h2>
      <p>Hi ${customerName},</p>
      <p>Thank you for your purchase. Here are your transaction details:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb;">Sale ID</th>
            <th style="text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb;">Date</th>
            <th style="text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb;">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">#${sale.id}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${new Date(sale.created_at || Date.now()).toLocaleDateString()}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">GHS ${sale.total_amount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div style="background: #f0f9ff; padding: 16px; border-radius: 6px; color: #0369a1;">
        <strong>Payment Status:</strong> ${sale.payment_status} <br/>
        <strong>Amount Paid:</strong> GHS ${sale.amount_paid.toFixed(2)} <br/>
        <strong>Balance Due:</strong> GHS ${sale.balance_due.toFixed(2)}
      </div>

      <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">
        If you have any questions, please contact the admin.
      </p>
    </div>
  `;

  const results = [];
  if (customer?.email) {
    try {
      const res = await sendEmail({ to: customer.email, subject, html });
      results.push(res);
    } catch (e) {
      console.error('Error sending customer receipt email:', e);
    }
  }
  if (adminEmail) {
    try {
      const res = await sendEmail({ to: adminEmail, subject, html });
      results.push(res);
    } catch (e) {
      console.error('Error sending admin receipt email:', e);
    }
  }

  return results.length > 0 ? results[0] : undefined;
};

const sendLowStockAlert = async (adminEmail, product) => {
  const subject = `⚠️ Low Stock Alert: ${product.name}`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #fee2e2; border-radius: 8px;">
      <h3 style="color: #ef4444;">Inventory Alert</h3>
      <p>The following item is running low on stock:</p>
      <ul>
        <li><strong>Product:</strong> ${product.name}</li>
        <li><strong>Current Stock:</strong> ${product.stock_quantity} ${product.selling_uom}</li>
        <li><strong>Threshold:</strong> ${product.low_stock_threshold}</li>
      </ul>
      <p>Please restock soon to avoid operational delays.</p>
    </div>
  `;
  return sendEmail({ to: adminEmail, subject, html });
};

module.exports = { sendEmail, sendReceiptEmail, sendLowStockAlert };
