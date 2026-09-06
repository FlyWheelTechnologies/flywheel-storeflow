import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

export default function SuperAdminNewOrg() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Default 30-day expiry
  const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    name: "",
    slug: "",
    primary_color: "#f97316",
    currency: "GHS",
    phone: "",
    address: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
    setup_fee: 1500,
    subscription_amount: 300,
    billing_cycle: "monthly",
    payment_status: "active",
    payment_terms: "GH₵ 1,500 setup fee + monthly subscription paid via Mobile Money to Godwin",
    subscription_expires_at: defaultExpiry
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
      let targetSlug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const orgPayload = {
        name: form.name,
        slug: targetSlug,
        primary_color: form.primary_color,
        currency: form.currency,
        admin_email: form.admin_email,
        phone: form.phone,
        address: form.address,
        setup_fee: parseFloat(form.setup_fee) || 0,
        subscription_amount: parseFloat(form.subscription_amount) || 0,
        billing_cycle: form.billing_cycle,
        payment_status: form.payment_status,
        payment_terms: form.payment_terms,
        subscription_expires_at: form.subscription_expires_at ? new Date(form.subscription_expires_at).toISOString() : null,
        last_payment_date: new Date().toISOString()
      };

      // 1. Insert Organization with automatic slug collision retry
      let { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert(orgPayload)
        .select()
        .single();

      if (orgError && (orgError.code === "23505" || orgError.message.includes("organizations_slug_key"))) {
        targetSlug = `${targetSlug}-${Math.floor(Math.random() * 899 + 100)}`;
        orgPayload.slug = targetSlug;

        const retryResult = await supabase
          .from("organizations")
          .insert(orgPayload)
          .select()
          .single();

        if (retryResult.error) throw retryResult.error;
        org = retryResult.data;
      } else if (orgError) {
        throw orgError;
      }

      // Log initial setup payment in subscription_payments ledger
      const initialCollected = (parseFloat(form.setup_fee) || 0) + (form.payment_status === "active" ? (parseFloat(form.subscription_amount) || 0) : 0);
      if (initialCollected > 0) {
        await supabase.from("subscription_payments").insert({
          organization_id: org.id,
          amount: initialCollected,
          payment_type: "setup_fee",
          payment_method: "MoMo",
          notes: `Initial onboarding setup fee (GH₵ ${form.setup_fee}) + subscription (GH₵ ${form.subscription_amount})`,
          recorded_by: currentUser?.email
        });
      }

      // 2. Invoke invite-user Edge Function to create admin account & send email (with graceful fallback)
      let inviteWarning = "";
      try {
        const { data: inviteData, error: inviteError } = await supabase.functions.invoke("invite-user", {
          body: {
            email: form.admin_email,
            password: form.admin_password,
            role: "admin",
            full_name: form.admin_name,
            organization_id: org.id
          }
        });

        if (inviteError || inviteData?.error) {
          throw new Error(inviteError?.message || inviteData?.error || "Edge function unavailable");
        }
      } catch (fnErr) {
        console.warn("Edge function invite-user unconfigured or failed, using direct Auth fallback:", fnErr.message);
        inviteWarning = " (Direct Auth fallback)";

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        });

        // Fallback: Create user directly via isolated Supabase Auth client
        const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
          email: form.admin_email.trim(),
          password: form.admin_password,
          options: {
            data: {
              full_name: form.admin_name.trim(),
              role: "admin",
              organization_id: org.id
            }
          }
        });

        if (signUpErr && signUpErr.message.toLowerCase().includes("already registered")) {
          // Link pre-existing account as admin to this new organization
          await supabase.from("profiles").update({
            role: "admin",
            organization_id: org.id,
            full_name: form.admin_name.trim() || undefined,
            updated_at: new Date().toISOString()
          }).ilike("email", form.admin_email.trim());
          inviteWarning = " (Linked pre-existing account as Admin)";
        } else if (signUpData?.user) {
          await supabase.from("profiles").upsert({
            id: signUpData.user.id,
            email: form.admin_email.trim(),
            full_name: form.admin_name.trim(),
            role: "admin",
            organization_id: org.id,
            updated_at: new Date().toISOString()
          });
        }
      }

      // 3. Log the creation in platform_logs
      await supabase.from("platform_logs").insert({
        organization_id: org.id,
        organization_name: org.name,
        action: "ORG_ONBOARD",
        details: `Successfully onboarded "${org.name}" with setup fee GH₵ ${form.setup_fee} & admin ${form.admin_email}${inviteWarning}`,
        user_email: currentUser?.email
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/admin/billing");
      }, 2500);

    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/admin" style={{ color: "#f97316", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ← Back to Super Admin
        </Link>
        <h2 className="section-title" style={{ marginTop: 8 }}>Onboard New Business</h2>
        <p style={{ color: "#6b7280", fontSize: 13 }}>Create a new tenant organization with custom Ghanaian commercial billing terms</p>
      </div>

      {success ? (
        <div style={{ background: "#d1fae5", border: "1px solid #a7f3d0", color: "#065f46", padding: 24, borderRadius: 12, textAlign: "center" }}>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>🎉 Onboarding Successful!</h3>
          <p style={{ fontSize: 14 }}>
            Organization <strong>{form.name}</strong> was created with setup fee GH₵ {form.setup_fee}.
          </p>
          <p style={{ fontSize: 12, color: "#047857", marginTop: 12 }}>Redirecting you to the Commercial Billing Hub...</p>
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
                <option value="GHS">GHS (₵) — Ghana Cedi</option>
                <option value="USD">USD ($) — US Dollar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="NGN">NGN (₦) — Nigerian Naira</option>
                <option value="KES">KES (KSh) — Kenyan Shilling</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Primary Theme Color</label>
              <input style={inp} type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
            <div>
              <label style={lbl}>Business Phone (MoMo / WhatsApp)</label>
              <input style={inp} type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+233..." />
            </div>
            <div>
              <label style={lbl}>Physical Address</label>
              <input style={inp} type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Store location..." />
            </div>
          </div>

          <h3 style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 8, marginBottom: 16, fontSize: 15, fontWeight: 700, color: "#374151" }}>
            2. Commercial Terms & Ghanaian Billing Structure
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Setup / Onboarding Fee (GH₵)</label>
              <input style={inp} type="number" value={form.setup_fee} onChange={e => setForm({ ...form, setup_fee: e.target.value })} placeholder="e.g. 1500" required />
            </div>
            <div>
              <label style={lbl}>Subscription Rate (GH₵)</label>
              <input style={inp} type="number" value={form.subscription_amount} onChange={e => setForm({ ...form, subscription_amount: e.target.value })} placeholder="e.g. 300" required />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Billing Cadence</label>
              <select style={inp} value={form.billing_cycle} onChange={e => setForm({ ...form, billing_cycle: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly (3 mos)</option>
                <option value="semi_annual">Semi-Annual (6 mos)</option>
                <option value="annual">Annual (Yearly)</option>
                <option value="one_time">One-time / Lifetime</option>
                <option value="custom">Custom Upfront</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Payment Status</label>
              <select style={inp} value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })}>
                <option value="active">Active (Paid)</option>
                <option value="pending">Pending Payment</option>
                <option value="trial">Trial Period</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Subscription Expiry Date</label>
              <input style={inp} type="date" value={form.subscription_expires_at} onChange={e => setForm({ ...form, subscription_expires_at: e.target.value })} required />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={lbl}>Custom Payment & Contract Terms</label>
            <input style={inp} type="text" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} placeholder="e.g. 50% upfront, balance due in 30 days. Paid via MoMo to Godwin." />
          </div>

          <h3 style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 8, marginBottom: 16, fontSize: 15, fontWeight: 700, color: "#374151" }}>
            3. Business Administrator Account
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
            {loading ? "Onboarding in progress..." : "Complete Setup & Launch Business"}
          </button>
        </form>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const inp = { width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ddd", fontSize: 13 };
