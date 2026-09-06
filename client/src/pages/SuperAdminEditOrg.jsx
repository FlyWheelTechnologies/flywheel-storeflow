import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  Building2, 
  CreditCard, 
  Users, 
  Trash2, 
  AlertTriangle, 
  ArrowLeft, 
  ExternalLink, 
  Check, 
  Plus, 
  UserCheck, 
  Shield, 
  Edit3, 
  Lock, 
  Mail, 
  Phone, 
  MapPin 
} from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

export default function SuperAdminEditOrg() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, impersonateOrg } = useAuth();

  // Active tab state
  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'billing' | 'staff' | 'danger'

  // Loading & notification state
  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");

  // Business form state
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    primary_color: "#f97316",
    currency: "GHS",
    phone: "",
    address: "",
    is_active: true,
    setup_fee: 1500,
    subscription_amount: 300,
    billing_cycle: "monthly",
    payment_status: "active",
    payment_terms: "",
    subscription_expires_at: "",
    tin: "",
    is_vat_registered: false,
    default_tax_rate: 20.0,
    default_tax_inclusive: true
  });

  // Staff accounts state
  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Add staff modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    full_name: "",
    email: "",
    role: "admin",
    password: ""
  });
  const [addingStaff, setAddingStaff] = useState(false);

  // Edit staff modal state
  const [staffToEdit, setStaffToEdit] = useState(null);
  const [editingStaff, setEditingStaff] = useState(false);

  // Danger Zone / Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Fetch organization & staff
  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: orgData, error: orgErr } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", id)
        .single();

      if (orgErr) throw orgErr;
      if (!orgData) throw new Error("Organization not found.");

      setOrg(orgData);
      setForm({
        name: orgData.name || "",
        slug: orgData.slug || "",
        primary_color: orgData.primary_color || "#f97316",
        currency: orgData.currency || "GHS",
        phone: orgData.phone || "",
        address: orgData.address || "",
        is_active: orgData.is_active !== undefined ? orgData.is_active : true,
        setup_fee: orgData.setup_fee !== undefined ? orgData.setup_fee : 1500,
        subscription_amount: orgData.subscription_amount !== undefined ? orgData.subscription_amount : 300,
        billing_cycle: orgData.billing_cycle || "monthly",
        payment_status: orgData.payment_status || "active",
        payment_terms: orgData.payment_terms || "",
        subscription_expires_at: orgData.subscription_expires_at
          ? new Date(orgData.subscription_expires_at).toISOString().split("T")[0]
          : "",
        tin: orgData.tin || "",
        is_vat_registered: !!orgData.is_vat_registered,
        default_tax_rate: orgData.default_tax_rate !== undefined ? orgData.default_tax_rate : 20.0,
        default_tax_inclusive: orgData.default_tax_inclusive !== undefined ? orgData.default_tax_inclusive : true
      });

      // Load staff profiles
      await loadStaff();
    } catch (err) {
      console.error("Error loading organization:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const { data: staffData, error: staffErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("organization_id", id)
        .order("created_at", { ascending: true });

      if (staffErr) throw staffErr;
      setStaff(staffData || []);
    } catch (err) {
      console.warn("Could not load staff accounts:", err.message);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  // 2. Save Business Profile & Commercial Terms
  const handleSaveOrg = async (e) => {
    if (e) e.preventDefault();
    if (savingOrg) return;
    setSavingOrg(true);
    setError("");

    try {
      const updatePayload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        primary_color: form.primary_color,
        currency: form.currency,
        phone: form.phone.trim(),
        address: form.address.trim(),
        is_active: !!form.is_active,
        setup_fee: parseFloat(form.setup_fee) || 0,
        subscription_amount: parseFloat(form.subscription_amount) || 0,
        billing_cycle: form.billing_cycle,
        payment_status: form.payment_status,
        payment_terms: form.payment_terms,
        subscription_expires_at: form.subscription_expires_at ? new Date(form.subscription_expires_at).toISOString() : null,
        tin: form.tin.trim(),
        is_vat_registered: !!form.is_vat_registered,
        default_tax_rate: parseFloat(form.default_tax_rate) || 0,
        default_tax_inclusive: !!form.default_tax_inclusive,
        updated_at: new Date().toISOString()
      };

      const { error: updateErr } = await supabase
        .from("organizations")
        .update(updatePayload)
        .eq("id", id);

      if (updateErr) throw updateErr;

      // Log update action
      await supabase.from("platform_logs").insert({
        organization_id: id,
        organization_name: form.name,
        action: "ORG_UPDATE",
        details: `Updated business settings & commercial terms for "${form.name}"`,
        user_email: currentUser?.email
      });

      setOrg(prev => ({ ...prev, ...updatePayload }));
      showNotification("Business details updated successfully!");
    } catch (err) {
      console.error("Save error:", err);
      setError(err.message);
      showNotification("Failed to update: " + err.message, "error");
    } finally {
      setSavingOrg(false);
    }
  };

  // 3. Add New Admin / Staff
  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    if (addingStaff) return;
    setAddingStaff(true);

    try {
      let inviteWarning = "";
      try {
        const { data: inviteData, error: inviteError } = await supabase.functions.invoke("invite-user", {
          body: {
            email: newStaff.email.trim(),
            password: newStaff.password,
            role: newStaff.role,
            full_name: newStaff.full_name.trim(),
            organization_id: id
          }
        });

        if (inviteError || inviteData?.error) {
          throw new Error(inviteError?.message || inviteData?.error || "Edge function unavailable");
        }
      } catch (fnErr) {
        console.warn("Edge function invite-user unconfigured, using Auth fallback:", fnErr.message);
        inviteWarning = " (Direct Auth fallback)";

        // Direct Auth Fallback
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: newStaff.email.trim(),
          password: newStaff.password,
          options: {
            data: {
              full_name: newStaff.full_name.trim(),
              role: newStaff.role,
              organization_id: id
            }
          }
        });

        if (signUpErr && !signUpErr.message.includes("already registered")) {
          throw signUpErr;
        }

        if (signUpData?.user) {
          await supabase.from("profiles").upsert({
            id: signUpData.user.id,
            email: newStaff.email.trim(),
            full_name: newStaff.full_name.trim(),
            role: newStaff.role,
            organization_id: id
          });
        }
      }

      // Log staff creation
      await supabase.from("platform_logs").insert({
        organization_id: id,
        organization_name: org.name,
        action: "STAFF_CREATE",
        details: `Created account for ${newStaff.email} with role "${newStaff.role}"${inviteWarning}`,
        user_email: currentUser?.email
      });

      setShowAddStaffModal(false);
      setNewStaff({ full_name: "", email: "", role: "admin", password: "" });
      await loadStaff();
      showNotification(`Account ${newStaff.email} added successfully!`);
    } catch (err) {
      console.error("Add staff error:", err);
      alert("Error adding account: " + err.message);
    } finally {
      setAddingStaff(false);
    }
  };

  // 4. Update Existing Staff Account
  const handleUpdateStaffSubmit = async (e) => {
    e.preventDefault();
    if (!staffToEdit || editingStaff) return;
    setEditingStaff(true);

    try {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          full_name: staffToEdit.full_name.trim(),
          role: staffToEdit.role,
          updated_at: new Date().toISOString()
        })
        .eq("id", staffToEdit.id);

      if (updateErr) throw updateErr;

      await supabase.from("platform_logs").insert({
        organization_id: id,
        organization_name: org.name,
        action: "STAFF_UPDATE",
        details: `Updated staff profile for ${staffToEdit.email} (Role: ${staffToEdit.role})`,
        user_email: currentUser?.email
      });

      setStaffToEdit(null);
      await loadStaff();
      showNotification("Staff member updated successfully!");
    } catch (err) {
      console.error("Update staff error:", err);
      alert("Failed to update staff member: " + err.message);
    } finally {
      setEditingStaff(false);
    }
  };

  // 5. Remove Staff Account from Organization
  const handleRemoveStaff = async (staffMember) => {
    if (!window.confirm(`Are you sure you want to remove ${staffMember.full_name || staffMember.email} from ${org.name}? They will no longer have access to this store.`)) {
      return;
    }

    try {
      // Unlink from organization
      const { error: unlinkErr } = await supabase
        .from("profiles")
        .update({ organization_id: null })
        .eq("id", staffMember.id);

      if (unlinkErr) throw unlinkErr;

      await supabase.from("platform_logs").insert({
        organization_id: id,
        organization_name: org.name,
        action: "STAFF_REMOVE",
        details: `Removed staff ${staffMember.email} from organization "${org.name}"`,
        user_email: currentUser?.email
      });

      await loadStaff();
      showNotification("Staff member unlinked from this business.");
    } catch (err) {
      console.error("Remove staff error:", err);
      alert("Failed to remove staff member: " + err.message);
    }
  };

  // 6. Delete Entire Business (Cascading Deletion)
  const handleDeleteBusiness = async () => {
    if (deleteConfirmText.trim() !== org.name.trim()) {
      alert("The entered business name does not match.");
      return;
    }

    setIsDeletingOrg(true);
    try {
      // Delete organization row (cascades products, sales, customers, debt ledgers, payments)
      const { error: delErr } = await supabase
        .from("organizations")
        .delete()
        .eq("id", id);

      if (delErr) throw delErr;

      // Log deletion event
      await supabase.from("platform_logs").insert({
        organization_id: null,
        organization_name: org.name,
        action: "ORG_DELETE",
        details: `Permanently deleted business "${org.name}" and all associated tenant records.`,
        user_email: currentUser?.email
      });

      setShowDeleteModal(false);
      navigate("/admin");
    } catch (err) {
      console.error("Delete business error:", err);
      alert("Failed to delete business: " + err.message);
      setIsDeletingOrg(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        <p>Loading business records and settings...</p>
      </div>
    );
  }

  if (error && !org) {
    return (
      <div style={{ padding: 32, maxWidth: 640, margin: "0 auto" }}>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: "0 0 8px 0", color: "#991b1b" }}>Error Loading Organization</h3>
          <p style={{ margin: "0 0 16px 0", color: "#b91c1c", fontSize: 14 }}>{error}</p>
          <Link to="/admin" style={{ color: "#b91c1c", fontWeight: 600, fontSize: 14 }}>
            ← Return to Super Admin Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Toast Banner */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 9999,
          background: toast.type === "error" ? "#ef4444" : "#10b981",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: 8,
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
          fontWeight: 600,
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          {toast.type === "error" ? "⚠️" : "✓"} {toast.message}
        </div>
      )}

      {/* Header Bar */}
      <div style={{ marginBottom: 20 }}>
        <Link 
          to="/admin" 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 6, 
            color: "#64748b", 
            textDecoration: "none", 
            fontSize: 13, 
            fontWeight: 600,
            marginBottom: 12 
          }}
        >
          <ArrowLeft size={16} /> Back to Super Admin
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: form.primary_color || "#f97316",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 700
              }}>
                {org.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#0f172a" }}>{org.name}</h1>
                  <span style={{
                    background: org.is_active ? "#d1fae5" : "#fef2f2",
                    color: org.is_active ? "#059669" : "#dc2626",
                    padding: "2px 10px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {org.is_active ? "Active" : "Suspended"}
                  </span>
                  <span style={{
                    background: "#e0f2fe",
                    color: "#0369a1",
                    padding: "2px 10px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {form.payment_status.toUpperCase()}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  Tenant ID: <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>{org.id}</code> • Slug: <strong>{org.slug}</strong>
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                impersonateOrg(org);
                navigate("/dashboard");
              }}
              className="quick-action-btn"
              style={{
                background: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <ExternalLink size={15} /> Enter Shop (Impersonate)
            </button>
            <button
              type="button"
              onClick={handleSaveOrg}
              disabled={savingOrg}
              style={{
                background: "#f97316",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                padding: "9px 18px",
                cursor: savingOrg ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
              }}
            >
              {savingOrg ? "Saving..." : "Save All Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid #e2e8f0",
        marginBottom: 24,
        gap: 8
      }}>
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "profile" ? "2px solid #f97316" : "2px solid transparent",
            color: activeTab === "profile" ? "#f97316" : "#64748b",
            fontWeight: activeTab === "profile" ? 700 : 500,
            fontSize: 14,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <Building2 size={16} /> Business Profile & Branding
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("billing")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "billing" ? "2px solid #f97316" : "2px solid transparent",
            color: activeTab === "billing" ? "#f97316" : "#64748b",
            fontWeight: activeTab === "billing" ? 700 : 500,
            fontSize: 14,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <CreditCard size={16} /> Commercial Terms & Tax
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "staff" ? "2px solid #f97316" : "2px solid transparent",
            color: activeTab === "staff" ? "#f97316" : "#64748b",
            fontWeight: activeTab === "staff" ? 700 : 500,
            fontSize: 14,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <Users size={16} /> Admins & Staff ({staff.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("danger")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "danger" ? "2px solid #dc2626" : "2px solid transparent",
            color: activeTab === "danger" ? "#dc2626" : "#94a3b8",
            fontWeight: activeTab === "danger" ? 700 : 500,
            fontSize: 14,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <AlertTriangle size={16} /> Danger Zone
        </button>
      </div>

      {/* TAB 1: Business Profile & Branding */}
      {activeTab === "profile" && (
        <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
            Business Identity & Store Configuration
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Business Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                URL Slug / Identifier
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "") })}
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Used for multi-tenant tenant isolation and deep links.</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Business Contact Phone
              </label>
              <div style={{ position: "relative" }}>
                <Phone size={15} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="024 XXX XXXX"
                  className="filter-input"
                  style={{ width: "100%", paddingLeft: 34, boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Currency Code
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="filter-select"
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="GHS">GHS (GH₵ - Ghanaian Cedi)</option>
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="GBP">GBP (£ - British Pound)</option>
                <option value="NGN">NGN (₦ - Nigerian Naira)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Brand Theme Color
              </label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  style={{ width: 44, height: 38, padding: 2, borderRadius: 6, border: "1px solid #cbd5e1", cursor: "pointer" }}
                />
                <input
                  type="text"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="filter-input"
                  style={{ flex: 1, boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Platform Status
              </label>
              <select
                value={form.is_active ? "active" : "suspended"}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}
                className="filter-select"
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="active">Active (Access Allowed)</option>
                <option value="suspended">Suspended (Access Blocked)</option>
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Physical Address / Store Location
              </label>
              <div style={{ position: "relative" }}>
                <MapPin size={15} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Spintex Road, Accra"
                  className="filter-input"
                  style={{ width: "100%", paddingLeft: 34, boxSizing: "border-box" }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleSaveOrg}
              disabled={savingOrg}
              className="quick-action-btn"
              style={{
                background: "#f97316",
                color: "#ffffff",
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600
              }}
            >
              {savingOrg ? "Saving..." : "Save Profile Details"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Commercial Billing & Ghana Tax */}
      {activeTab === "billing" && (
        <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
            Ghanaian SaaS Pricing & GRA Compliance
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Setup Fee (GH₵)
              </label>
              <input
                type="number"
                value={form.setup_fee}
                onChange={(e) => setForm({ ...form, setup_fee: e.target.value })}
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Subscription Amount (GH₵)
              </label>
              <input
                type="number"
                value={form.subscription_amount}
                onChange={(e) => setForm({ ...form, subscription_amount: e.target.value })}
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Billing Cadence
              </label>
              <select
                value={form.billing_cycle}
                onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}
                className="filter-select"
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly (Every 3 months)</option>
                <option value="annual">Annual (Yearly)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Subscription Payment Status
              </label>
              <select
                value={form.payment_status}
                onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
                className="filter-select"
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="active">Active (Paid up)</option>
                <option value="pending">Pending Payment</option>
                <option value="suspended">Suspended / Overdue</option>
                <option value="trial">Trial Period</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Subscription Expiration Date
              </label>
              <input
                type="date"
                value={form.subscription_expires_at}
                onChange={(e) => setForm({ ...form, subscription_expires_at: e.target.value })}
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                GRA Tax Identification Number (TIN)
              </label>
              <input
                type="text"
                value={form.tin}
                onChange={(e) => setForm({ ...form, tin: e.target.value })}
                placeholder="P000XXXXXXX"
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={form.default_tax_rate}
                onChange={(e) => setForm({ ...form, default_tax_rate: e.target.value })}
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.is_vat_registered}
                  onChange={(e) => setForm({ ...form, is_vat_registered: e.target.checked })}
                  style={{ width: 16, height: 16 }}
                />
                Business is VAT Registered with GRA
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.default_tax_inclusive}
                  onChange={(e) => setForm({ ...form, default_tax_inclusive: e.target.checked })}
                  style={{ width: 16, height: 16 }}
                />
                Store Item Prices are Tax Inclusive
              </label>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Commercial Payment Terms & Agreement Notes
              </label>
              <textarea
                value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                placeholder="e.g. GH₵ 1,500 setup fee + monthly subscription paid via Mobile Money to Godwin"
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleSaveOrg}
              disabled={savingOrg}
              className="quick-action-btn"
              style={{
                background: "#f97316",
                color: "#ffffff",
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 600
              }}
            >
              {savingOrg ? "Saving..." : "Save Commercial Settings"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Admins & Staff Accounts */}
      {activeTab === "staff" && (
        <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
                Admin & Staff Accounts ({staff.length})
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                Manage the business administrators, storekeepers, and auditors for this business.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddStaffModal(true)}
              className="quick-action-btn"
              style={{
                background: "#f97316",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Plus size={15} /> Add Account
            </button>
          </div>

          <div className="table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: s.role === "admin" ? "#f97316" : s.role === "auditor" ? "#8b5cf6" : "#0284c7",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 700
                        }}>
                          {(s.full_name || s.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{s.full_name || "Staff Member"}</div>
                          {s.role === "admin" && (
                            <span style={{ fontSize: 10, color: "#f97316", fontWeight: 700 }}>Org Administrator</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{s.email}</td>
                    <td>
                      <span style={{
                        background: s.role === "admin" ? "#fff7ed" : s.role === "auditor" ? "#f5f3ff" : "#f0f9ff",
                        color: s.role === "admin" ? "#c2410c" : s.role === "auditor" ? "#6d28d9" : "#0369a1",
                        border: `1px solid ${s.role === "admin" ? "#ffedd5" : s.role === "auditor" ? "#ede9fe" : "#e0f2fe"}`,
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "capitalize"
                      }}>
                        {s.role}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#64748b" }}>
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : "Existing"}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setStaffToEdit(s)}
                          title="Edit staff details and role"
                          style={{
                            background: "#f1f5f9",
                            color: "#334155",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(s)}
                          title="Remove user from this organization"
                          style={{
                            background: "#fef2f2",
                            color: "#dc2626",
                            border: "1px solid #fecaca",
                            borderRadius: 6,
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: 12,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && !loadingStaff && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", color: "#64748b", padding: 24 }}>
                      No staff accounts found for this business. Click <strong>Add Account</strong> above to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Danger Zone */}
      {activeTab === "danger" && (
        <div style={{
          background: "#fff5f5",
          border: "2px solid #fecaca",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#991b1b" }}>
                Danger Zone: Delete Business
              </h3>
              <span style={{ fontSize: 13, color: "#b91c1c" }}>
                Permanent and irreversible business erasure
              </span>
            </div>
          </div>

          <p style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.6, marginBottom: 16 }}>
            Deleting <strong>"{org.name}"</strong> will permanently delete all associated multi-tenant assets:
          </p>

          <ul style={{ fontSize: 13, color: "#991b1b", lineHeight: 1.8, marginBottom: 24, paddingLeft: 20 }}>
            <li>All products, catalog categories, and inventory stock tracking</li>
            <li>All completed and pending sales orders, receipts, and line-item records</li>
            <li>All customer directories and customer outstanding balance ledgers</li>
            <li>All expense entries, accounting records, and payment history</li>
            <li>Staff profiles will be disassociated and unlinked from this store</li>
          </ul>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmText("");
                setShowDeleteModal(true);
              }}
              style={{
                background: "#dc2626",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)"
              }}
            >
              <Trash2 size={16} /> Permanently Delete This Business...
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Add Staff Member */}
      {showAddStaffModal && (
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
          <form onSubmit={handleAddStaffSubmit} style={{
            background: "#ffffff",
            borderRadius: 16,
            maxWidth: 480,
            width: "100%",
            padding: 24,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                Add Staff Account for {org.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                style={{ background: "none", border: "none", fontSize: 18, color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Full Name *
              </label>
              <input
                type="text"
                value={newStaff.full_name}
                onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                placeholder="e.g. Kwame Mensah"
                required
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Email Address *
              </label>
              <input
                type="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                placeholder="staff@store.com"
                required
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Role Assignment *
              </label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                className="filter-select"
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="admin">Administrator (Full Store Control)</option>
                <option value="storekeeper">Storekeeper / Cashier (Sales & Inventory)</option>
                <option value="auditor">Auditor (View Only Reports)</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Temporary Initial Password *
              </label>
              <input
                type="password"
                value={newStaff.password}
                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                placeholder="Minimum 6 characters"
                minLength={6}
                required
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  padding: "9px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingStaff}
                style={{
                  background: "#f97316",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: addingStaff ? "not-allowed" : "pointer"
                }}
              >
                {addingStaff ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Edit Staff Member */}
      {staffToEdit && (
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
          <form onSubmit={handleUpdateStaffSubmit} style={{
            background: "#ffffff",
            borderRadius: 16,
            maxWidth: 460,
            width: "100%",
            padding: 24,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                Edit Account: {staffToEdit.email}
              </h3>
              <button
                type="button"
                onClick={() => setStaffToEdit(null)}
                style={{ background: "none", border: "none", fontSize: 18, color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Full Name
              </label>
              <input
                type="text"
                value={staffToEdit.full_name || ""}
                onChange={(e) => setStaffToEdit({ ...staffToEdit, full_name: e.target.value })}
                className="filter-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                Role Assignment
              </label>
              <select
                value={staffToEdit.role}
                onChange={(e) => setStaffToEdit({ ...staffToEdit, role: e.target.value })}
                className="filter-select"
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="admin">Administrator (Full Store Control)</option>
                <option value="storekeeper">Storekeeper / Cashier (Sales & Inventory)</option>
                <option value="auditor">Auditor (View Only Reports)</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setStaffToEdit(null)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  padding: "9px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editingStaff}
                style={{
                  background: "#f97316",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: editingStaff ? "not-allowed" : "pointer"
                }}
              >
                {editingStaff ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Delete Organization Confirmation Flow */}
      {showDeleteModal && (
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
            maxWidth: 500,
            width: "100%",
            padding: 24,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            border: "1px solid #fecaca"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#fef2f2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                  Delete "{org.name}"
                </h3>
                <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                  Irreversible Business Erasure
                </span>
              </div>
            </div>

            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#991b1b", lineHeight: 1.5, fontWeight: 500 }}>
                This will permanently delete all products, sales records, customer balances, expenses, and payments for <strong>{org.name}</strong>.
              </p>
            </div>

            <p style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>
              To confirm deletion, please type the exact business name <strong>"{org.name}"</strong> below:
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={org.name}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                marginBottom: 20,
                outline: "none",
                boxSizing: "border-box"
              }}
              autoFocus
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingOrg}
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
                onClick={handleDeleteBusiness}
                disabled={deleteConfirmText.trim() !== org.name.trim() || isDeletingOrg}
                style={{
                  background: (deleteConfirmText.trim() === org.name.trim() && !isDeletingOrg) ? "#dc2626" : "#fca5a5",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: (deleteConfirmText.trim() === org.name.trim() && !isDeletingOrg) ? "pointer" : "not-allowed"
                }}
              >
                {isDeletingOrg ? "Deleting Business..." : "Permanently Delete Business"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
