import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Trash,
  PencilSimple,
  MagnifyingGlass,
  Plus,
  ArrowRight,
  Buildings,
  Users,
  Receipt,
  WarningCircle,
  ShieldCheck,
  CheckCircle,
  TrendUp,
  Storefront,
  EnvelopeSimple,
  Phone,
  CurrencyCircleDollar,
  Sparkle
} from "@phosphor-icons/react";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import "./SuperAdmin.css";
import "./Dashboard.css";

export default function SuperAdminDashboard() {
  const { user, impersonateOrg } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalOrgs: 0, totalUsers: 0, orphanedUsers: 0, totalSales: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [isPurgingOrphans, setIsPurgingOrphans] = useState(false);

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

      // Active staff accounts assigned to registered businesses (excluding super admins)
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("organization_id", "is", null)
        .neq("role", "super_admin");

      // Orphaned staff accounts without any organization
      const { count: orphanedUserCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .is("organization_id", null)
        .neq("role", "super_admin");

      const { count: salesCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true });

      setStats({
        totalOrgs: orgCount || 0,
        totalUsers: userCount || 0,
        orphanedUsers: orphanedUserCount || 0,
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

  const handleCleanupOrphanedStaff = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete all ${stats.orphanedUsers} orphaned staff accounts? These accounts belonged to deleted stores and are unassigned.`)) {
      return;
    }

    setIsPurgingOrphans(true);
    try {
      const { error: delErr } = await supabase
        .from("profiles")
        .delete()
        .is("organization_id", null)
        .neq("role", "super_admin");

      if (delErr) throw delErr;

      toast.success(`Successfully removed ${stats.orphanedUsers} orphaned staff accounts`);
      await fetchData();
    } catch (err) {
      console.error("Cleanup error:", err);
      toast.error("Failed to clean up orphaned accounts: " + err.message);
    } finally {
      setIsPurgingOrphans(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!orgToDelete) return;
    if (deleteConfirmationInput.trim() !== orgToDelete.name.trim()) {
      toast.error("The typed business name does not match.");
      return;
    }

    setIsDeleting(true);
    try {
      // 1. Delete associated staff profiles for this business (preserve super admins)
      const { error: staffDelErr } = await supabase
        .from("profiles")
        .delete()
        .eq("organization_id", orgToDelete.id)
        .neq("role", "super_admin");

      if (staffDelErr) console.warn("Staff deletion warning:", staffDelErr.message);

      // 2. Delete organization (Cascade deletes products, sales, customers, etc.)
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
        details: `Permanently deleted business "${orgToDelete.name}" and removed associated staff accounts.`,
        user_email: user?.email,
      });

      const deletedName = orgToDelete.name;
      setOrgToDelete(null);
      setDeleteConfirmationInput("");
      fetchData();
      toast.success(`Business "${deletedName}" permanently deleted`);
    } catch (err) {
      console.error("Delete organization error:", err);
      toast.error("Error deleting business: " + err.message);
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
      toast.success(`Business status set to ${!currentStatus ? 'Active' : 'Suspended'}`);
    } catch (err) {
      toast.error("Error toggling organization status: " + err.message);
    }
  };

  const filteredOrgs = useMemo(() => {
    if (!orgSearchQuery.trim()) return orgs;
    const q = orgSearchQuery.toLowerCase();
    return orgs.filter(o =>
      (o.name || "").toLowerCase().includes(q) ||
      (o.slug || "").toLowerCase().includes(q) ||
      (o.admin_email || "").toLowerCase().includes(q)
    );
  }, [orgs, orgSearchQuery]);

  if (loading) {
    return (
      <div className="super-admin-container">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="skeleton" style={{ height: 40, width: 280 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 420, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="super-admin-container">
      {/* Top Header */}
      <div className="super-header">
        <div className="super-header__titles">
          <div className="super-badge-row">
            <span className="super-platform-badge super-platform-badge--live">
              Production Gateway
            </span>
            <span className="super-platform-badge">
              Master Command
            </span>
          </div>
          <h1 className="super-header__title">Super Admin Portal</h1>
          <p className="super-header__subtitle">
            Executive Multi-Tenant Control Hub & Business Fleet Management
          </p>
        </div>

        <div className="super-header__actions">
          <Link to="/admin/billing" className="super-btn super-btn--secondary">
            <CurrencyCircleDollar size={18} weight="duotone" />
            Commercial MRR
          </Link>
          <Link to="/admin/organizations/new" className="super-btn super-btn--primary">
            <Plus size={18} weight="bold" />
            Onboard New Business
          </Link>
        </div>
      </div>

      {error && (
        <div style={{
          background: "#fef2f2",
          color: "#991b1b",
          padding: "14px 18px",
          borderRadius: 12,
          marginBottom: 24,
          fontSize: 13.5,
          border: "1px solid #fee2e2",
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          <WarningCircle size={20} weight="fill" color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Orphaned Staff Accounts Banner */}
      {stats.orphanedUsers > 0 && (
        <div className="super-alert-banner">
          <div className="super-alert-banner__left">
            <div className="super-alert-banner__icon">
              <WarningCircle size={22} weight="fill" />
            </div>
            <div className="super-alert-banner__text">
              <strong>{stats.orphanedUsers} Orphaned Staff Account{stats.orphanedUsers > 1 ? "s" : ""} Detected:</strong>{" "}
              These credentials belonged to purged businesses and have no tenant anchor.
            </div>
          </div>
          <button
            onClick={handleCleanupOrphanedStaff}
            disabled={isPurgingOrphans}
            className="super-alert-banner__btn"
          >
            {isPurgingOrphans ? "Purging..." : `Purge ${stats.orphanedUsers} Orphaned Accounts`}
          </button>
        </div>
      )}

      {/* Modern KPI Cards Grid */}
      <div className="super-kpi-grid">
        <div className="super-kpi-card">
          <div className="super-kpi-card__top">
            <span className="super-kpi-card__label">Active Businesses</span>
            <div className="super-kpi-card__icon-box super-kpi-card__icon-box--blue">
              <Buildings size={22} weight="duotone" />
            </div>
          </div>
          <div className="super-kpi-card__value">{stats.totalOrgs}</div>
          <div className="super-kpi-card__footer">
            <span className="super-kpi-card__subtitle">Subscribed tenant stores</span>
            <span className="super-kpi-card__badge super-kpi-card__badge--green">Online</span>
          </div>
        </div>

        <div className="super-kpi-card">
          <div className="super-kpi-card__top">
            <span className="super-kpi-card__label">Staff Accounts</span>
            <div className="super-kpi-card__icon-box super-kpi-card__icon-box--purple">
              <Users size={22} weight="duotone" />
            </div>
          </div>
          <div className="super-kpi-card__value">{stats.totalUsers}</div>
          <div className="super-kpi-card__footer">
            <span className="super-kpi-card__subtitle">Admins & Storekeepers</span>
            <span className="super-kpi-card__badge">Managed</span>
          </div>
        </div>

        <div className="super-kpi-card">
          <div className="super-kpi-card__top">
            <span className="super-kpi-card__label">Transactions Volume</span>
            <div className="super-kpi-card__icon-box super-kpi-card__icon-box--emerald">
              <Receipt size={22} weight="duotone" />
            </div>
          </div>
          <div className="super-kpi-card__value">{stats.totalSales}</div>
          <div className="super-kpi-card__footer">
            <span className="super-kpi-card__subtitle">Total receipts generated</span>
            <span className="super-kpi-card__badge super-kpi-card__badge--green">Audited</span>
          </div>
        </div>

        <div className="super-kpi-card">
          <div className="super-kpi-card__top">
            <span className="super-kpi-card__label">Security & RLS</span>
            <div className="super-kpi-card__icon-box super-kpi-card__icon-box--orange">
              <ShieldCheck size={22} weight="duotone" />
            </div>
          </div>
          <div className="super-kpi-card__value" style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={26} weight="fill" color="#10b981" />
            Isolated
          </div>
          <div className="super-kpi-card__footer">
            <span className="super-kpi-card__subtitle">Row-Level Security Active</span>
            <span className="super-kpi-card__badge super-kpi-card__badge--green">Enforced</span>
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="super-main-grid">
        {/* Left Column: Registered Businesses Card */}
        <div className="super-card">
          <div className="super-card__header">
            <div className="super-card__title-group">
              <h2 className="super-card__title">Registered Businesses</h2>
              <span className="super-card__count-badge">
                {filteredOrgs.length} of {orgs.length}
              </span>
            </div>

            <div className="super-search-wrapper">
              <MagnifyingGlass size={15} weight="bold" className="super-search-icon" />
              <input
                type="text"
                placeholder="Search by name, slug, email..."
                value={orgSearchQuery}
                onChange={(e) => setOrgSearchQuery(e.target.value)}
                className="super-search-input"
              />
            </div>
          </div>

          {/* Desktop Table */}
          <div className="super-table-container">
            <table className="super-table">
              <thead>
                <tr>
                  <th>Business Identity</th>
                  <th>Slug</th>
                  <th>Admin Contact</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((o) => {
                  const initial = (o.name || "B")[0].toUpperCase();
                  const brandColor = o.primary_color || "#f97316";

                  return (
                    <tr key={o.id}>
                      <td>
                        <div className="super-org-info">
                          <div className="super-org-avatar" style={{ background: brandColor }}>
                            {o.logo_url ? (
                              <img src={o.logo_url} alt={o.name} />
                            ) : (
                              initial
                            )}
                          </div>
                          <div className="super-org-names">
                            <span className="super-org-name">{o.name}</span>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>
                              {o.currency || "GHS"} • Created {new Date(o.created_at || Date.now()).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="super-org-slug">/{o.slug}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: "#334155" }}>
                            {o.admin_email || "No email assigned"}
                          </span>
                          {o.phone && (
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{o.phone}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          onClick={() => toggleOrgStatus(o.id, o.is_active)}
                          className={`super-status-pill ${o.is_active ? "super-status-pill--active" : "super-status-pill--suspended"}`}
                          title="Click to toggle status"
                        >
                          <span className="super-status-dot" />
                          {o.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td>
                        <div className="super-action-group" style={{ justifyContent: "flex-end" }}>
                          <Link
                            to={`/admin/organizations/${o.id}/edit`}
                            className="super-action-btn super-action-btn--edit"
                            title={`Edit ${o.name}`}
                          >
                            <PencilSimple size={13} weight="bold" />
                            Edit
                          </Link>
                          <button
                            onClick={() => handleImpersonate(o)}
                            className="super-action-btn super-action-btn--enter"
                            title={`Enter Shop as Super Admin`}
                          >
                            Enter Shop
                            <ArrowRight size={13} weight="bold" />
                          </button>
                          <button
                            onClick={() => {
                              setOrgToDelete(o);
                              setDeleteConfirmationInput("");
                            }}
                            className="super-action-btn super-action-btn--delete"
                            title={`Permanently delete ${o.name}`}
                          >
                            <Trash size={14} weight="bold" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrgs.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", color: "#64748b", padding: 36 }}>
                      {orgs.length === 0 ? "No businesses onboarded yet. Click '+ Onboard New Business' to start." : `No businesses found matching "${orgSearchQuery}".`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Stream (Active on screens <= 768px, vertically scrollable) */}
          <div className="super-mobile-cards">
            {filteredOrgs.map((o) => {
              const initial = (o.name || "B")[0].toUpperCase();
              const brandColor = o.primary_color || "#f97316";

              return (
                <div key={o.id} className="super-biz-card">
                  <div className="super-biz-card__top">
                    <div className="super-org-info">
                      <div className="super-org-avatar" style={{ background: brandColor }}>
                        {o.logo_url ? <img src={o.logo_url} alt={o.name} /> : initial}
                      </div>
                      <div className="super-org-names">
                        <span className="super-org-name">{o.name}</span>
                        <span className="super-org-slug">/{o.slug}</span>
                      </div>
                    </div>

                    <span
                      onClick={() => toggleOrgStatus(o.id, o.is_active)}
                      className={`super-status-pill ${o.is_active ? "super-status-pill--active" : "super-status-pill--suspended"}`}
                    >
                      <span className="super-status-dot" />
                      {o.is_active ? "Active" : "Suspended"}
                    </span>
                  </div>

                  <div className="super-biz-card__meta">
                    <div className="super-biz-card__meta-item">
                      <span className="super-biz-card__meta-label">Admin Contact</span>
                      <span className="super-biz-card__meta-val">{o.admin_email || "None"}</span>
                    </div>
                    <div className="super-biz-card__meta-item">
                      <span className="super-biz-card__meta-label">Currency & Phone</span>
                      <span className="super-biz-card__meta-val">
                        {o.currency || "GHS"} {o.phone ? `• ${o.phone}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="super-biz-card__actions">
                    <Link
                      to={`/admin/organizations/${o.id}/edit`}
                      className="super-action-btn super-action-btn--edit"
                    >
                      <PencilSimple size={14} weight="bold" />
                      Edit
                    </Link>
                    <button
                      onClick={() => handleImpersonate(o)}
                      className="super-action-btn super-action-btn--enter"
                    >
                      Enter Shop
                      <ArrowRight size={14} weight="bold" />
                    </button>
                    <button
                      onClick={() => {
                        setOrgToDelete(o);
                        setDeleteConfirmationInput("");
                      }}
                      className="super-action-btn super-action-btn--delete"
                    >
                      <Trash size={15} weight="bold" />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredOrgs.length === 0 && (
              <div style={{ textAlign: "center", color: "#64748b", padding: 24 }}>
                {orgs.length === 0 ? "No businesses onboarded yet." : `No results found for "${orgSearchQuery}".`}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Platform Activity Feed */}
        <div className="super-card">
          <div className="super-card__header">
            <h2 className="super-card__title">Platform Activity Feed</h2>
            <span className="super-platform-badge super-platform-badge--live">Live Audit</span>
          </div>

          <div className="super-feed-container">
            {logs.map((l) => {
              const isCreate = (l.action || "").includes("ONBOARD") || (l.action || "").includes("CREATE");
              const isDelete = (l.action || "").includes("DELETE") || (l.action || "").includes("REMOVE");
              const isStaff = (l.action || "").includes("STAFF") || (l.action || "").includes("USER");

              const tagClass = isCreate
                ? "super-feed-tag--create"
                : isDelete
                ? "super-feed-tag--delete"
                : isStaff
                ? "super-feed-tag--staff"
                : "";

              const d = new Date(l.created_at);
              const today = new Date();
              const isToday = d.toDateString() === today.toDateString();
              const timeStr = isToday
                ? `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

              return (
                <div key={l.id} className="super-feed-item">
                  <div className="super-feed-header">
                    <span className="super-feed-org">{l.organization_name || "Platform"}</span>
                    <span className="super-feed-time">{timeStr}</span>
                  </div>
                  <div className="super-feed-body">
                    <span className={`super-feed-tag ${tagClass}`}>{l.action}</span>
                    {l.details}
                  </div>
                  {l.user_email && (
                    <div className="super-feed-user">
                      Actor: {l.user_email}
                    </div>
                  )}
                </div>
              );
            })}
            {logs.length === 0 && (
              <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 20 }}>
                No platform activity recorded yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modern Delete Confirmation Modal */}
      {orgToDelete && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: 20,
            maxWidth: 480,
            width: "100%",
            padding: 28,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid #fee2e2"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#fef2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#dc2626",
                flexShrink: 0
              }}>
                <WarningCircle size={26} weight="fill" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0f172a" }}>
                  Delete Organization
                </h3>
                <span style={{ fontSize: 12.5, color: "#64748b" }}>Permanent & Irreversible Fleet Action</span>
              </div>
            </div>

            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: 14,
              marginBottom: 18
            }}>
              <p style={{ margin: 0, fontSize: 13, color: "#991b1b", lineHeight: 1.5, fontWeight: 500 }}>
                <strong>Critical Warning:</strong> Erasing <strong>"{orgToDelete.name}"</strong> will permanently destroy all its products, accounting ledgers, customers, sales invoices, and staff credentials.
              </p>
            </div>

            <p style={{ fontSize: 13, color: "#475569", marginBottom: 10, lineHeight: 1.4 }}>
              To confirm this action, please type the business name <strong>"{orgToDelete.name}"</strong> below:
            </p>

            <input
              type="text"
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              placeholder={orgToDelete.name}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1.5px solid #cbd5e1",
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
                className="super-btn super-btn--secondary"
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
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: (deleteConfirmationInput.trim() === orgToDelete.name.trim() && !isDeleting) ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease"
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
