import { Link } from "react-router-dom";
import "./Dashboard.css";

export default function SuperAdminApiKeys() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ongyutrabagetgdebdib.supabase.co";
  const hasKey = !!(import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 className="section-title">🔑 API Keys & Services Telemetry</h2>
          <p style={{ color: "#6b7280", fontSize: 13 }}>Monitor connected SaaS integrations, API keys, Edge Functions, and payment gateways</p>
        </div>
        <Link to="/admin" className="quick-action-btn" style={{ textDecoration: "none" }}>
          ← Back to Super Admin
        </Link>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {/* Supabase Service status */}
        <div className="table-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Supabase Database & Auth API</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>Target URL: <code>{supabaseUrl}</code></p>
          </div>
          <span style={{ background: hasKey ? "#d1fae5" : "#fef2f2", color: hasKey ? "#059669" : "#dc2626", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            {hasKey ? "✓ Connected & Active" : "⚠️ Key Unconfigured"}
          </span>
        </div>

        {/* Resend Email API status */}
        <div className="table-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Resend Transactional Email API</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>Sends welcome invites, password resets, and customer receipts</p>
          </div>
          <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            ⚡ Edge Function Secret (`RESEND_API_KEY`)
          </span>
        </div>

        {/* Mobile Money / Paystack status */}
        <div className="table-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Ghanaian Mobile Money (MoMo) / Paystack Gateway</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>Direct MoMo payment collection and subscription auto-renewals</p>
          </div>
          <span style={{ background: "#fef3c7", color: "#b45309", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            🟡 Manual Ledger Mode Active (Paystack Ready)
          </span>
        </div>

        {/* Deno Edge Functions status */}
        <div className="table-card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Deno Edge Functions Inventory</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12 }}>
              <strong>invite-user</strong>
              <div style={{ color: "#64748b", marginTop: 2 }}>Staff & Admin provisioning</div>
            </div>
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12 }}>
              <strong>send-receipt</strong>
              <div style={{ color: "#64748b", marginTop: 2 }}>Customer PDF receipts</div>
            </div>
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12 }}>
              <strong>send-low-stock-alert</strong>
              <div style={{ color: "#64748b", marginTop: 2 }}>Low stock alert trigger</div>
            </div>
            <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12 }}>
              <strong>notify-deposit</strong>
              <div style={{ color: "#64748b", marginTop: 2 }}>Customer credit notifications</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
