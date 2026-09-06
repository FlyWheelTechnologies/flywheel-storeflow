import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Trash2, Edit3 } from "lucide-react";
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

  const [orgToDelete, setOrgToDelete] = useState(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteOrg = async () => {
    if (!orgToDelete) return;
    if (deleteConfirmationInput.trim() !== orgToDelete.name.trim()) {
      alert("The typed business name does not match.");
      return;
    }

    setIsDeleting(true);
    try {
      // Delete organization (Cascade deletes products, sales, customers, etc.)
      const { error: deleteErr } = await supabase
        .from("organizations")
        .delete()
        .eq("id", orgToDelete.id);

      if (deleteErr) throw deleteErr;

      // Log deletion event in platform_logs
      await supabase.from("platform_logs").insert({
        organization_id: null,
        organization_name: orgToDelete.name,
        action: "ORG_DELETE",
        details: `Permanently deleted business "${orgToDelete.name}"`,
        user_email: user?.email,
      });

      setOrgToDelete(null);
      setDeleteConfirmationInput("");
      fetchData();
    } catch (err) {
      console.error("Delete organization error:", err);
      alert("Error deleting business: " + err.message);
    } finally {
      setIsDeleting(false);
    }
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
                    <td style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Link
                        to={`/admin/organizations/${o.id}/edit`}
                        title={`Edit ${o.name} and staff`}
                        style={{
                          background: "#f8fafc",
                          color: "#334155",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          padding: "5px 9px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none"
                        }}
                      >
                        <Edit3 size={13} />
                        Edit
                      </Link>
                      <button
                        onClick={() => handleImpersonate(o)}
                        className="quick-action-btn"
                        style={{
                          background: "#e0f2fe",
                          color: "#0369a1",
                          fontSize: 12,
                          padding: "4px 10px",
                          minHeight: "auto"
                        }}
                      >
                        Enter Shop →
                      </button>
                      <button
                        onClick={() => {
                          setOrgToDelete(o);
                          setDeleteConfirmationInput("");
                        }}
                        title={`Delete ${o.name}`}
                        style={{
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: 6,
                          padding: "5px 8px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <Trash2 size={14} />
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

      {/* Delete Confirmation Modal */}
      {orgToDelete && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            maxWidth: 480,
            width: "100%",
            padding: 24,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            border: "1px solid #fee2e2"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#dc2626" }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>Delete Organization</h3>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Irreversible Business Erasure</span>
              </div>
            </div>

            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#991b1b", lineHeight: 1.5, fontWeight: 500 }}>
                <strong>Warning:</strong> Deleting <strong>"{orgToDelete.name}"</strong> will permanently erase all linked products, sales transactions, customer debts, expenses, and staff access.
              </p>
            </div>

            <p style={{ fontSize: 13, color: "#475569", marginBottom: 8, lineHeight: 1.4 }}>
              To confirm permanent deletion, please type the exact business name <strong>"{orgToDelete.name}"</strong> below:
            </p>

            <input
              type="text"
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              placeholder={orgToDelete.name}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                marginBottom: 20,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box"
              }}
              autoFocus
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setOrgToDelete(null);
                  setDeleteConfirmationInput("");
                }}
                disabled={isDeleting}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteOrg}
                disabled={deleteConfirmationInput.trim() !== orgToDelete.name.trim() || isDeleting}
                style={{
                  background: (deleteConfirmationInput.trim() === orgToDelete.name.trim() && !isDeleting) ? "#dc2626" : "#fca5a5",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: (deleteConfirmationInput.trim() === orgToDelete.name.trim() && !isDeleting) ? "pointer" : "not-allowed"
                }}
              >
                {isDeleting ? "Deleting Business..." : "Permanently Delete Business"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
