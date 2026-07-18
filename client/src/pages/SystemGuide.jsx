import React from 'react';
import { useAuth } from '../context/AuthContext';
import './SystemGuide.css';

export default function SystemGuide() {
  const { activeOrg } = useAuth();
  const orgName = activeOrg?.name || 'StoreFlow';

  return (
    <div className="page-wrapper system-guide-page">
      <div className="guide-container">
        <header className="guide-header">
          <h1 className="guide-title">System Guide & Terms of Use</h1>
          <p className="guide-subtitle">StoreFlow by Flywheel — {orgName}</p>
        </header>

        <section className="guide-section terms-section">
          <h2 className="section-title">Terms of Use</h2>
          <div className="terms-box">
            <p><strong>1. Acceptance of Terms</strong><br />
            By accessing and using this inventory management system, you agree to be bound by these terms. This system is the property of {orgName} and is powered by Flywheel Technologies. Unauthorized access or use is strictly prohibited.</p>

            <p><strong>2. User Accounts and Security</strong><br />
            You are responsible for maintaining the confidentiality of your login credentials. Any actions performed under your account are your responsibility. You must notify the administrator immediately of any unauthorized use of your account.</p>

            <p><strong>3. Data Integrity and Privacy</strong><br />
            All data entered into this system, including sales records, customer information, and financial data, is the property of {orgName}. You agree to enter accurate data and not to tamper with or manipulate records maliciously.</p>

            <p><strong>4. System Availability and Modifications</strong><br />
            While we strive to ensure the system is available 24/7, we do not guarantee uninterrupted access. The system may be updated or modified at any time to improve features or fix issues.</p>

            <p><strong>5. Limitation of Liability</strong><br />
            Flywheel Technologies and {orgName} are not liable for any data loss, financial loss, or business interruption resulting from the use or inability to use this system.</p>
          </div>
        </section>

        <section className="guide-section features-section">
          <h2 className="section-title">System Features & How It Works</h2>
          
          <div className="feature-block">
            <h3>📊 Dashboard (Command Center)</h3>
            <p>The Dashboard is your starting point. It provides a real-time overview of your business operations.</p>
            <ul>
              <li><strong>Today's Cash In:</strong> Shows total physical cash and mobile money collected today.</li>
              <li><strong>Today's Revenue:</strong> Total volume of sales recorded (both paid and credit).</li>
              <li><strong>Pending Deposits:</strong> Count of orders paid in advance awaiting fulfillment.</li>
              <li><strong>Stock Value:</strong> Total value of all items currently in the warehouse (calculated at Cost Price).</li>
              <li><strong>Low Stock:</strong> Number of items that have fallen below their minimum threshold.</li>
              <li><strong>Charts:</strong> Visualize revenue trends over 7 days, 30 days, or Year-over-Year.</li>
              <li><strong>Quick Insights:</strong> Displays your best-selling items and gross margin profitability.</li>
            </ul>
          </div>

          <div className="feature-block">
            <h3>💰 Sales Management</h3>
            <p>This module handles all customer transactions and records.</p>
            <ul>
              <li><strong>Sales Records:</strong> View all past transactions. You can filter by date, payment status (Paid, Credit, Partial, Deposit), and search by customer or product.</li>
              <li><strong>Record Sale:</strong> Use the action button to record a new sale. You can add multiple products, specify quantities, apply discounts, and select the payment method.</li>
              <li><strong>Customers:</strong> Manage your customer database. Track lifetime spent and view individual purchase histories.</li>
            </ul>
          </div>

          <div className="feature-block">
            <h3>📦 Stock & Products</h3>
            <p>Manage your inventory and product catalog here.</p>
            <ul>
              <li><strong>Products List:</strong> View all products with their current stock levels, cost price, and selling price.</li>
              <li><strong>Add/Edit Product:</strong> Add new items to the inventory or update existing ones. Set low stock thresholds to get alerts when inventory runs low.</li>
              <li><strong>Stock Deductions:</strong> The system automatically deducts stock when a sale is recorded or fulfilled.</li>
            </ul>
          </div>

          <div className="feature-block">
            <h3>🧾 Accounting & Reports</h3>
            <p>Keep track of the financial health of the business.</p>
            <ul>
              <li><strong>Daily Report (Entries):</strong> View a detailed ledger of all financial entries (Sales, Expenses, Deposits) for any given day.</li>
              <li><strong>Expenses:</strong> Record business operational costs. Categorize expenses to understand where money is going.</li>
              <li><strong>Deposits:</strong> Manage customer prepayments (Pure Deposits). This is used when a customer pays in advance for goods to be collected later.</li>
            </ul>
          </div>

          <div className="feature-block">
            <h3>⚙️ Admin & Security</h3>
            <p>Restricted features for system maintenance and monitoring.</p>
            <ul>
              <li><strong>System Logs:</strong> A complete audit trail of actions performed in the system (e.g., who recorded a sale, who deleted a product). This ensures accountability.</li>
              <li><strong>User & Roles:</strong> Manage staff access. Roles include:
                <ul>
                  <li><em>Admin:</em> Full access to all features and settings.</li>
                  <li><em>Storekeeper:</em> Access to stock and sales recording, but restricted from financial charts and logs.</li>
                  <li><em>Auditor:</em> Access to reports and logs for verification purposes.</li>
                </ul>
              </li>
            </ul>
          </div>
        </section>

        <footer className="guide-footer">
          <p>© 2026 Flywheel Technologies. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
