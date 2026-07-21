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
          <h1 className="guide-title">
            Store<span style={{ color: '#eb5e28' }}>Flow</span> System Guide
          </h1>
          <p className="guide-subtitle">by Flywheel — Official User Manual & Terms of Use</p>
        </header>

        <section className="guide-section terms-section">
          <h2 className="section-title">Terms of Use</h2>
          <div className="terms-box">
            <p><strong>1. Acceptance of Terms</strong><br />
            By accessing and utilizing the StoreFlow inventory management system, you agree to comply with and be bound by these Terms of Use. This platform is powered and maintained by Flywheel Technologies (bookflywheel.com). Unauthorized access, data extraction, or tampering is strictly prohibited.</p>

            <p><strong>2. User Accounts and Role Security</strong><br />
            You are responsible for maintaining the absolute confidentiality of your login credentials. Actions performed in the system are logged to your profile email. If you suspect unauthorized access or a security breach, report it immediately to your organization administrator.</p>

            <p><strong>3. Data Integrity and Tenancy</strong><br />
            StoreFlow operates under hardened multi-tenant isolation. All entered inventory details, cost prices, invoices, and deposits are secured via Row-Level Security (RLS). Users agree to input accurate data and to refrain from performing malicious double-entry ledger manipulations.</p>

            <p><strong>4. Service Availability & Edge Functions</strong><br />
            The platform leverages serverless edge compute for transactional triggers (receipt PDFs, low-stock notifications, email routing). While we guarantee 99.9% availability of database nodes, scheduled maintenance may occasionally cause brief offline sync periods.</p>

            <p><strong>5. Limitation of Liability</strong><br />
            Flywheel Technologies is not liable for business interruptions, inventory discrepancies, or financial inaccuracies resulting from misreported ledger logs, system override actions, or incorrect cost-selling price ratios.</p>
          </div>
        </section>

        <section className="guide-section features-section">
          <h2 className="section-title">System Features & Documentation</h2>
          
          <div className="feature-block">
            <h3>📊 Dashboard (Real-time Command Center)</h3>
            <p>The main operations dashboard tracks key metrics across your business:</p>
            <ul>
              <li><strong>Today's Cash In:</strong> Aggregates physical cash, checks, and Mobile Money (MoMo) payments collected.</li>
              <li><strong>Today's Revenue:</strong> Tracks total invoice volumes generated today (both cleared sales and credit sales).</li>
              <li><strong>Pending Deposits:</strong> Shows prepayments awaiting stock allocation and fulfillment.</li>
              <li><strong>Stock Value:</strong> Calculates total warehouse valuation dynamically based on product Cost Price.</li>
              <li><strong>Interactive Trend Charts:</strong> Analyzes revenue patterns over 7 days, 30 days, or Year-over-Year comparisons.</li>
            </ul>
          </div>

          <div className="feature-block">
            <h3>💰 Sales & Invoice Management</h3>
            <p>This module processes transactions and logs customer relations:</p>
            <ul>
              <li><strong>Record Sale:</strong> Add multiple items, specify quantities, calculate tax (inclusive or exclusive), and register payments (Cash, MoMo, Card, or Credit).</li>
              <li><strong>Automatic Invoices:</strong> Automatically generates custom formatted invoice numbers (e.g., INV-103) with details for customers.</li>
              <li><strong>Fulfillment Tracking:</strong> Track if items are physically dispatched or pending collection (essential for bulk hardware materials like cement, pipes, and iron rods).</li>
            </ul>
          </div>

          <div className="feature-block">
            <h3>📦 Inventory & Products Catalog</h3>
            <p>Provides complete control over stock quantities and conversion settings:</p>
            <ul>
              <li><strong>UOM Conversion Factors:</strong> Supports purchasing wholesale (e.g., bags/boxes) and selling retail (e.g., pcs/single items) with automatic conversion ratios.</li>
              <li><strong>Low Stock Thresholds:</strong> Triggers SMS/email warnings through Edge functions to notify storekeepers when an item's count drops below the set limit.</li>
              <li><strong>Automatic Deductions:</strong> Sales immediately reduce stock quantities. Fulfilling prepayments updates warehouse values in real-time.</li>
            </ul>
          </div>

          <div className="feature-block">
            <h3>🧾 Double-Entry Accounting & Ledger</h3>
            <p>Maintains high-integrity financial records automatically for auditing:</p>
            <ul>
              <li><strong>Automatic Journal Postings:</strong> Every transaction auto-posts debit/credit records to the Ledger (balancing Cash, Receivables, Cost of Goods Sold, and Revenue).</li>
              <li><strong>Customer Deposits:</strong> Track "Pure Deposits" where customers deposit cash in advance to lock in prices, and fulfill items progressively as they are picked up.</li>
              <li><strong>Expenses Ledger:</strong> Track operational costs (salaries, fuel, utilities) to compute accurate Net Profit margins.</li>
            </ul>
          </div>

          <div className="feature-block">
            <h3>⚙️ Security, Access Roles & Audit Logs</h3>
            <p>Enforces strict access control and operational visibility:</p>
            <ul>
              <li><strong>Auditor Role:</strong> Read-only access to ledger reports, daily transaction journals, and audit logs.</li>
              <li><strong>Storekeeper Role:</strong> Permitted to write sales and products, but blocked from viewing overall financial charts or logs.</li>
              <li><strong>Admin Role:</strong> Full system access, including invite permissions and organization-wide configuration updates.</li>
              <li><strong>System Audit Trail:</strong> Complete historical logs of critical operations, capturing who performed every action (insert, update, delete) and when.</li>
            </ul>
          </div>
        </section>

        <footer className="guide-footer">
          <p>© 2026 Flywheel Technologies (bookflywheel.com). All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
