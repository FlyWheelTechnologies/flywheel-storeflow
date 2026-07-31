import { Link } from "react-router-dom";
import "./Dashboard.css";

export default function SuperAdminAI() {
  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff7ed", border: "1px solid #ffedd5", color: "#ea580c", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            <span>✨ STOREFLOW AI ENGINE</span>
            <span style={{ background: "#ea580c", color: "#fff", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>COMING SOON</span>
          </div>
          <h2 className="section-title">StoreFlow AI — Next-Gen Retail Intelligence</h2>
          <p style={{ color: "#6b7280", fontSize: 13 }}>Predictive stock analytics, automated double-entry anomaly detection, and AI sales copilot for Ghanaian businesses.</p>
        </div>
      </div>

      {/* Feature Showcase Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
        
        {/* Card 1: Inventory Demand Forecasting */}
        <div className="table-card" style={{ padding: 24, borderTop: "4px solid #f97316" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
            Stockout Demand & Reorder AI
          </h3>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 16 }}>
            Analyzes historical sales velocity across retail items to predict exact stockout dates and generate automated purchase orders before high-demand items run out.
          </p>
          <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12, color: "#475569", border: "1px dashed #cbd5e1" }}>
            💡 <em>"Cement stock predicted to run out in 4 days based on current weekly sales velocity."</em>
          </div>
        </div>

        {/* Card 2: Accounting Anomaly Detector */}
        <div className="table-card" style={{ padding: 24, borderTop: "4px solid #10b981" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
            Double-Entry Accounting Anomaly Guard
          </h3>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 16 }}>
            Continuously audits journal entries, MoMo transactions, and cash register logs to detect unusual discounts, uncollected customer debt, or register discrepancies.
          </p>
          <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12, color: "#475569", border: "1px dashed #cbd5e1" }}>
            🔍 <em>"Flagged 3 sales with >20% manual discount recorded by Attendant B."</em>
          </div>
        </div>

        {/* Card 3: Retail Copilot for Storekeepers */}
        <div className="table-card" style={{ padding: 24, borderTop: "4px solid #3b82f6" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
            Natural Language Sales & Inventory Copilot
          </h3>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 16 }}>
            Allows storekeepers and shop owners to query sales records, generate receipt PDFs, and check stock levels using natural voice or text in English & Twi.
          </p>
          <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12, color: "#475569", border: "1px dashed #cbd5e1" }}>
            🗣️ <em>"Show me total cash sales collected today for Roofing Sheets."</em>
          </div>
        </div>
      </div>

      {/* Development Roadmap Banner */}
      <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderRadius: 16, padding: 32, color: "#ffffff", textAlign: "center" }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 10px 0", letterSpacing: "-0.01em" }}>
          StoreFlow AI Engine Under Active Development
        </h3>
        <p style={{ color: "#94a3b8", fontSize: 14, maxWidth: 600, margin: "0 auto 20px auto", lineHeight: 1.6 }}>
          We are training domain-specific models on Ghanaian retail inventory workflows. Stay tuned as we roll out StoreFlow AI to pilot business partners.
        </p>
        <Link to="/admin" className="quick-action-btn" style={{ textDecoration: "none", background: "#f97316", color: "#fff", display: "inline-block", padding: "10px 24px" }}>
          ← Return to Super Admin Dashboard
        </Link>
      </div>
    </div>
  );
}
