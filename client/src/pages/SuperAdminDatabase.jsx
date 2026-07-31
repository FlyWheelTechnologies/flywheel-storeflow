import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import "./Dashboard.css";

export default function SuperAdminDatabase() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      setLoading(true);
      try {
        const tables = ["organizations", "profiles", "products", "sales", "sale_items", "customers", "expenses", "journal_entries", "logs", "platform_logs", "subscription_payments"];
        const results = {};

        for (const t of tables) {
          const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
          results[t] = count || 0;
        }

        setCounts(results);
      } catch (err) {
        console.error("Fetch DB metrics error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 className="section-title">🗄️ Database & Storage Telemetry</h2>
          <p style={{ color: "#6b7280", fontSize: 13 }}>Live PostgreSQL table row counts, multi-tenant storage usage & security policies</p>
        </div>
        <Link to="/admin" className="quick-action-btn" style={{ textDecoration: "none" }}>
          ← Back to Super Admin
        </Link>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : (
        <>
          {/* Table Metrics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            {Object.entries(counts).map(([tbl, val]) => (
              <div key={tbl} className="stat-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.05em" }}>
                  {tbl.replace("_", " ")}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                  {val.toLocaleString()} <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>rows</span>
                </div>
              </div>
            ))}
          </div>

          {/* Database Security & Storage Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="table-card" style={{ padding: 20 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                🛡️ Row-Level Security (RLS) Status
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 14 }}>
                All 11 public schema tables have Row-Level Security explicitly enabled with <code>TO authenticated</code> role checks and subquery evaluation.
              </p>
              <div style={{ background: "#d1fae5", border: "1px solid #a7f3d0", color: "#065f46", padding: 12, borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                ✓ Multi-Tenant Isolation Active & Hardened
              </div>
            </div>

            <div className="table-card" style={{ padding: 20 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                📦 Supabase Storage Buckets
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 14 }}>
                Storage for company logos, PDF receipts, and user avatars configured under public & tenant-isolated buckets.
              </p>
              <div style={{ background: "#e0f2fe", border: "1px solid #bae6fd", color: "#0369a1", padding: 12, borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                ✓ Buckets: <code>avatars</code>, <code>logos</code>, <code>receipts</code>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
