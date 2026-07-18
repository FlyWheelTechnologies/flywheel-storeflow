import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

export default function SuperAdminNewOrg() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    name: "",
    slug: "",
    primary_color: "#f97316",
    currency: "GHS",
    phone: "",
    address: "",
    admin_name: "",
    admin_email: "",
    admin_password: ""
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleNameChange = (e) => {
    const val = e.target.value;
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setForm({ ...form, name: val, slug });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      // 1. Insert Organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: form.name,
          slug: form.slug,
          primary_color: form.primary_color,
          currency: form.currency,
          admin_email: form.admin_email,
          phone: form.phone,
          address: form.address,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Invoke invite-user Edge Function to create admin account & send email
      const { data: inviteData, error: inviteError } = await supabase.functions.invoke("invite-user", {
        body: {
          email: form.admin_email,
          password: form.admin_password,
          role: "admin",
          full_name: form.admin_name,
          organization_id: org.id
        }
      });

      if (inviteError) throw inviteError;
      if (inviteData?.error) throw new Error(inviteData.error);

      // 3. Log the creation in platform_logs
      await supabase.from("platform_logs").insert({
        organization_id: org.id,
        organization_name: org.name,
        action: "ORG_ONBOARD",
        details: `Successfully onboarded "${org.name}" and created admin account for ${form.admin_email}`,
        user_email: currentUser?.email
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/admin");
      }, 3000);

    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 650, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/admin" style={{ color: "#f97316", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ← Back to Super Admin
        </Link>
        <h2 className="section-title" style={{ marginTop: 8 }}>Onboard New Business</h2>
        <p style={{ color: "#6b7280", fontSize: 13 }}>Create a new tenant organization and provision its admin account</p>
      </div>

      {success ? (
        <div style={{ background: "#d1fae5", border: "1px solid #a7f3d0", color: "#065f46", padding: 24, borderRadius: 12, textAlign: "center" }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>🎉 Onboarding Successful!</h3>
          <p style={{ fontSize: 14 }}>
            Organization <strong>{form.name}</strong> was created. An invitation email was sent to <strong>{form.admin_email}</strong>.
          </p>
          <p style={{ fontSize: 12, color: "#047857", marginTop: 12 }}>Redirecting you to the dashboard...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="table-card" style={{ padding: 24 }}>
          {error && (
            <div style={{ background: "#fef2f2", color: "#ef4444", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "13px", border: "1px solid #fee2e2" }}>
              ⚠️ {error}
            </div>
          )}

          <h3 style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 8, marginBottom: 16, fontSize: 15, fontWeight: 700, color: "#374151" }}>
            1. Business Information
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Business Name</label>
              <input style={inp} type="text" value={form.name} onChange={handleNameChange} placeholder="e.g. Acme Retailers" required />
            </div>
            <div>
              <label style={lbl}>Unique URL Slug</label>
              <input style={inp} type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="e.g. acme" required />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div>
              <label style={lbl}>Currency Code</label>
              <select style={inp} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="GHS">GHS (₵)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="NGN">NGN (₦)</option>
                <option value="KES">KES (KSh)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Primary Theme Color</label>
              <input style={inp} type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
            <div>
              <label style={lbl}>Business Phone</label>
              <input style={inp} type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+233..." />
            </div>
            <div>
              <label style={lbl}>Physical Address</label>
              <input style={inp} type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Store location..." />
            </div>
          </div>

          <h3 style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 8, marginBottom: 16, fontSize: 15, fontWeight: 700, color: "#374151" }}>
            2. Business Administrator Account
          </h3>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Admin Full Name</label>
            <input style={inp} type="text" value={form.admin_name} onChange={e => setForm({ ...form, admin_name: e.target.value })} placeholder="John Doe" required />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
            <div>
              <label style={lbl}>Admin Email Address</label>
              <input style={inp} type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} placeholder="admin@acme.com" required />
            </div>
            <div>
              <label style={lbl}>Temporary Password</label>
              <input style={inp} type="password" value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} placeholder="At least 6 characters" required />
            </div>
          </div>

          <button type="submit" className="quick-action-btn" style={{ width: "100%", height: 42, fontSize: 14 }} disabled={loading}>
            {loading ? "Onboarding in progress..." : "Complete Setup & Invite Admin"}
          </button>
        </form>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const inp = { width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
