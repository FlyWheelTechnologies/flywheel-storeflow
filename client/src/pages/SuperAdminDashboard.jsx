import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

export default function SuperAdminDashboard() {
  const { user, impersonateOrg } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalOrgs: 0, totalUsers: 0, totalSales: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Organizations
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .order("name", { ascending: true });

      if (orgError) throw orgError;
      setOrgs(orgData || []);

      // 2. Fetch Platform Logs
      const { data: logData, error: logError } = await supabase
        .from("platform_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (logError) throw logError;
      setLogs(logData || []);

      // 3. Fetch general stats across all orgs
      const { count: orgCount } = await supabase
        .from("organizations")
        .select("*", { count: "exact", head: true });

      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: salesCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true });

      setStats({
        totalOrgs: orgCount || 0,
        totalUsers: userCount || 0,
        totalSales: salesCount || 0,
      });

    } catch (err) {
      console.error("Super Admin Dashboard fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImpersonate = (org) => {
    impersonateOrg(org);
    navigate("/dashboard");
  };

  const toggleOrgStatus = async (orgId, currentStatus) => {
    try {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ is_active: !currentStatus })
        .eq("id", orgId);

      if (updateError) throw updateError;
      fetchData();
    } catch (err) {
      alert("Error toggling organization status: " + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2 className="section-title">StoreFlow Super Admin</h2>
        <div className="skeleton" style={{ height: 100, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 className="section-title">Super Admin Dashboard</h2>
          <p style={{ color: "#6b7280", fontSize: 13 }}>StoreFlow Platform Command Center</p>
        </div>
        <Link to="/admin/organizations/new" className="quick-action-btn" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          + Onboard New Business
        </Link>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#ef4444", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "13px", border: "1px solid #fee2e2" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Grid Statistics */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card__header">
            <span className="stat-card__label">Active Businesses</span>
          </div>
          <div className="stat-card__value">{stats.totalOrgs}</div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Subscribed to StoreFlow SaaS</span>
        </div>
        <div className="stat-card">
          <div className="stat-card__header">
            <span className="stat-card__label">Total Staff Accounts</span>
          </div>
          <div className="stat-card__value">{stats.totalUsers}</div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Admins & Storekeepers</span>
        </div>
        <div className="stat-card">
          <div className="stat-card__header">
            <span className="stat-card__label">Overall Platform Transactions</span>
          </div>
          <div className="stat-card__value">{stats.totalSales}</div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Sales records processed</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Organizations Table */}
        <div className="table-card">
          <div className="table-card__header">
            <h3 className="table-card__title">Registered Businesses</h3>
          </div>
          <div className="table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Slug</th>
                  <th>Admin Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {o.logo_url && <img src={o.logo_url} alt="Logo" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />}
                        <span>{o.name}</span>
                      </div>
                    </td>
                    <td>{o.slug}</td>
                    <td>{o.admin_email}</td>
                    <td>
                      <span
                        onClick={() => toggleOrgStatus(o.id, o.is_active)}
                        style={{
                          background: o.is_active ? "#d1fae5" : "#fef2f2",
                          color: o.is_active ? "#059669" : "#ef4444",
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        {o.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td style={{ display: "flex", gap: 12 }}>
                      <button
                        onClick={() => handleImpersonate(o)}
                        className="quick-action-btn"
                        style={{
                          background: "#e0f2fe",
                          color: "#0369a1",
                          fontSize: 12,
                          padding: "4px 8px",
                          minHeight: "auto"
                        }}
                      >
                        Enter Shop →
                      </button>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", color: "#6b7280" }}>No businesses registered yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Platform Logs / Activity Stream */}
        <div className="table-card" style={{ maxHeight: 500, overflowY: "auto" }}>
          <div className="table-card__header">
            <h3 className="table-card__title">Platform Activity Feed</h3>
          </div>
          <div style={{ padding: 16 }}>
            {logs.map((l) => (
              <div key={l.id} style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: "#1e293b" }}>{l.organization_name || "Platform"}</span>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{new Date(l.created_at).toLocaleTimeString()}</span>
                </div>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
                  <span style={{ color: "#3b82f6", fontWeight: 600 }}>{l.action}</span> - {l.details}
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>By: {l.user_email}</div>
              </div>
            ))}
            {logs.length === 0 && (
              <p style={{ textAlign: "center", color: "#6b7280", fontSize: 12 }}>No logs recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
