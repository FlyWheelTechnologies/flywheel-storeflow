import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Buildings,
  CreditCard,
  UserCheck,
  CheckCircle,
  Eye,
  EyeSlash,
  Sparkle,
  ShieldCheck,
  WarningCircle,
  Plus
} from "@phosphor-icons/react";
import { supabase } from "../services/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "../context/AuthContext";
import { BUSINESS_INDUSTRIES, getIndustryCategories, getIndustryInfo } from "../constants/industries";
import "./SuperAdmin.css";
import "./Dashboard.css";

export default function SuperAdminNewOrg() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Default 30-day expiry
  const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    name: "",
    slug: "",
    industry: "auto_parts",
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
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdOrg, setCreatedOrg] = useState(null);

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
        name: form.name.trim(),
        slug: targetSlug,
        industry: form.industry || "auto_parts",
        primary_color: form.primary_color,
        currency: form.currency,
        admin_email: form.admin_email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        setup_fee: parseFloat(form.setup_fee) || 0,
        subscription_amount: parseFloat(form.subscription_amount) || 0,
        billing_cycle: form.billing_cycle,
        payment_status: form.payment_status,
        payment_terms: form.payment_terms,
        subscription_expires_at: form.subscription_expires_at ? new Date(form.subscription_expires_at).toISOString() : null,
        last_payment_date: new Date().toISOString()
      };

      // 1. Insert Organization with automatic slug collision retry and column safety
      let { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert(orgPayload)
        .select()
        .single();

      // Graceful fallback if industry column does not exist yet in DB schema
      if (orgError && orgError.code === "42703") {
        delete orgPayload.industry;
        const resWithoutIndustry = await supabase
          .from("organizations")
          .insert(orgPayload)
          .select()
          .single();
        org = resWithoutIndustry.data;
        orgError = resWithoutIndustry.error;
      }

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

      // Store industry locally as backup for instant category synchronization
      if (org?.id && form.industry) {
        try {
          localStorage.setItem(`storeflow_org_industry_${org.id}`, form.industry);
        } catch (_) {}
      }

      setCreatedOrg(org);

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
            email: form.admin_email.trim(),
            password: form.admin_password,
            role: "admin",
            full_name: form.admin_name.trim(),
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
          const { error: linkErr } = await supabase.from("profiles").update({
            role: "admin",
            organization_id: org.id,
            full_name: form.admin_name.trim() || undefined,
            updated_at: new Date().toISOString()
          }).ilike("email", form.admin_email.trim());
          if (linkErr) throw linkErr;
          inviteWarning = " (Linked pre-existing account as Admin)";
        }

        const isFakeUser = signUpData?.user && 
          (!signUpData.user.identities || signUpData.user.identities.length === 0);

        if (!signUpErr && isFakeUser) {
          const { error: linkErr } = await supabase.from("profiles").update({
            role: "admin",
            organization_id: org.id,
            full_name: form.admin_name.trim() || undefined,
            updated_at: new Date().toISOString()
          }).ilike("email", form.admin_email.trim());
          if (linkErr) throw linkErr;
          inviteWarning = " (Linked pre-existing account as Admin)";
        } else if (!signUpErr && signUpData?.user) {
          const { error: upsertErr } = await supabase.from("profiles").upsert({
            id: signUpData.user.id,
            email: form.admin_email.trim(),
            full_name: form.admin_name.trim(),
            role: "admin",
            organization_id: org.id,
            updated_at: new Date().toISOString()
          });
          if (upsertErr) throw upsertErr;
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

    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="super-admin-container" style={{ maxWidth: 860 }}>
      {/* Back button & Title */}
      <div style={{ marginBottom: 24 }}>
        <Link
          to="/admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#f97316",
            textDecoration: "none",
            fontSize: 13.5,
            fontWeight: 700,
            marginBottom: 12
          }}
        >
          <ArrowLeft size={16} weight="bold" />
          Back to Admin Console
        </Link>
        <h1 className="super-header__title" style={{ fontSize: 26, margin: 0 }}>
          Onboard New Business
        </h1>
        <p className="super-header__subtitle">
          Provision a dedicated multi-tenant business instance with Ghanaian commercial billing and store owner credentials
        </p>
      </div>

      {success ? (
        <div className="super-card" style={{ padding: 36, textAlign: "center", alignItems: "center" }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#ecfdf5",
            color: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20
          }}>
            <CheckCircle size={36} weight="fill" />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
            🎉 Business Successfully Onboarded!
          </h2>
          <p style={{ fontSize: 14.5, color: "#475569", maxWidth: 520, lineHeight: 1.5, marginBottom: 24 }}>
            <strong>{form.name}</strong> is now live with slug <code>/{form.slug}</code>. The administrator account (<strong>{form.admin_email}</strong>) has been provisioned.
          </p>

          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "16px 24px",
            marginBottom: 28,
            width: "100%",
            maxWidth: 480,
            textAlign: "left"
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>
              Store Credentials Snapshot
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 6 }}>
              <span style={{ color: "#64748b" }}>Admin Email:</span>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{form.admin_email}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 6 }}>
              <span style={{ color: "#64748b" }}>Password:</span>
              <span style={{ fontWeight: 600, fontFamily: "monospace", color: "#0f172a" }}>{form.admin_password}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span style={{ color: "#64748b" }}>Currency:</span>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{form.currency}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <Link to="/admin" className="super-btn super-btn--secondary">
              Admin Console
            </Link>
            <Link to="/admin/billing" className="super-btn super-btn--primary">
              View Commercial MRR
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {error && (
            <div style={{
              background: "#fef2f2",
              color: "#991b1b",
              padding: "14px 18px",
              borderRadius: 12,
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

          {/* Section 1: Business Identity */}
          <div className="super-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Buildings size={18} weight="duotone" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  1. Business Identity & Branding
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>Store name, URL path, currency and brand accent</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="super-form-label">Business Name *</label>
                <input
                  type="text"
                  className="super-form-input"
                  value={form.name}
                  onChange={handleNameChange}
                  placeholder="e.g. GoldCoast Mart"
                  required
                />
              </div>

              <div>
                <label className="super-form-label">Unique URL Slug *</label>
                <input
                  type="text"
                  className="super-form-input"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                  placeholder="e.g. goldcoast-mart"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="super-form-label">Industry / Business Category *</label>
              <select
                className="super-form-select"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                required
              >
                {BUSINESS_INDUSTRIES.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.icon} {ind.name}
                  </option>
                ))}
              </select>

              {/* Dynamic Category Preview */}
              {(() => {
                const selectedInfo = getIndustryInfo(form.industry);
                const cats = getIndustryCategories(form.industry);
                return (
                  <div style={{
                    marginTop: 10,
                    padding: "12px 14px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{selectedInfo?.icon}</span>
                        <span>{selectedInfo?.name}</span>
                        <span style={{ fontSize: 10, padding: "2px 6px", background: "#e0f2fe", color: "#0369a1", borderRadius: 4, fontWeight: 700 }}>
                          {selectedInfo?.badge}
                        </span>
                      </span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        {cats.length} tailored categories
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px 0" }}>
                      {selectedInfo?.description}. When adding products, the store owner will see these preset categories automatically, plus the ability to add new ones.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {cats.slice(0, 8).map((cat) => (
                        <span key={cat} style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          color: "#334155",
                          fontWeight: 500
                        }}>
                          {cat}
                        </span>
                      ))}
                      {cats.length > 8 && (
                        <span style={{ fontSize: 11, padding: "3px 8px", color: "#64748b", fontStyle: "italic" }}>
                          +{cats.length - 8} more...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="super-form-label">Operating Currency *</label>
                <select
                  className="super-form-select"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  <option value="GHS">GHS (₵) — Ghanaian Cedi</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="NGN">NGN (₦) — Nigerian Naira</option>
                  <option value="KES">KES (KSh) — Kenyan Shilling</option>
                </select>
              </div>

              <div>
                <label className="super-form-label">Brand Accent Color</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    style={{ width: 44, height: 42, padding: 2, borderRadius: 8, border: "1px solid #cbd5e1", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: "#475569" }}>
                    {form.primary_color}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div>
                <label className="super-form-label">Store Phone (WhatsApp / MoMo)</label>
                <input
                  type="text"
                  className="super-form-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+233 24 000 0000"
                />
              </div>

              <div>
                <label className="super-form-label">Store Physical Address</label>
                <input
                  type="text"
                  className="super-form-input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Accra Mall, Spintex Rd"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Commercial Terms */}
          <div className="super-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CreditCard size={18} weight="duotone" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  2. Ghanaian Commercial Terms & Billing
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>Onboarding fee, monthly recurring revenue and renewal cycle</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="super-form-label">Setup Fee (GH₵) *</label>
                <input
                  type="number"
                  className="super-form-input"
                  value={form.setup_fee}
                  onChange={(e) => setForm({ ...form, setup_fee: e.target.value })}
                  placeholder="1500"
                  required
                />
              </div>

              <div>
                <label className="super-form-label">Subscription Rate (GH₵) *</label>
                <input
                  type="number"
                  className="super-form-input"
                  value={form.subscription_amount}
                  onChange={(e) => setForm({ ...form, subscription_amount: e.target.value })}
                  placeholder="300"
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="super-form-label">Billing Cadence</label>
                <select
                  className="super-form-select"
                  value={form.billing_cycle}
                  onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly (3 months)</option>
                  <option value="semi_annual">Semi-Annual (6 months)</option>
                  <option value="annual">Annual (1 Year)</option>
                  <option value="one_time">One-Time / Lifetime</option>
                </select>
              </div>

              <div>
                <label className="super-form-label">Payment Status</label>
                <select
                  className="super-form-select"
                  value={form.payment_status}
                  onChange={(e) => setForm({ ...form, payment_status: e.target.value })}
                >
                  <option value="active">Active (Paid)</option>
                  <option value="pending">Pending Payment</option>
                  <option value="trial">Trial Period</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div>
                <label className="super-form-label">Initial Expiry Date *</label>
                <input
                  type="date"
                  className="super-form-input"
                  value={form.subscription_expires_at}
                  onChange={(e) => setForm({ ...form, subscription_expires_at: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="super-form-label">Payment & Contract Notes</label>
              <input
                type="text"
                className="super-form-input"
                value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                placeholder="e.g. Paid via Mobile Money to Godwin"
              />
            </div>
          </div>

          {/* Section 3: Store Owner Credentials */}
          <div className="super-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#faf5ff", color: "#9333ea", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserCheck size={18} weight="duotone" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  3. Store Administrator Account
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>Initial store owner credentials for tenant login</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="super-form-label">Admin Full Name *</label>
              <input
                type="text"
                className="super-form-input"
                value={form.admin_name}
                onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                placeholder="e.g. Kwame Mensah"
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <div>
                <label className="super-form-label">Admin Email Address *</label>
                <input
                  type="email"
                  className="super-form-input"
                  value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                  placeholder="admin@business.com"
                  required
                />
              </div>

              <div>
                <label className="super-form-label">Temporary Initial Password *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="super-form-input"
                    value={form.admin_password}
                    onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                    placeholder="At least 6 characters"
                    required
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: 4
                    }}
                  >
                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="super-btn super-btn--primary"
            style={{ width: "100%", padding: 14, fontSize: 15 }}
            disabled={loading}
          >
            {loading ? "Onboarding and Launching Business..." : "Complete Setup & Launch Business"}
          </button>
        </form>
      )}

      {/* Form Utilities Style */}
      <style>{`
        .super-form-label {
          display: block;
          font-size: 12.5px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 6px;
        }
        .super-form-input, .super-form-select {
          width: 100%;
          padding: 10px 14px;
          border-radius: 9px;
          border: 1px solid #cbd5e1;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          background: #ffffff;
          box-sizing: border-box;
          font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .super-form-input:focus, .super-form-select:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.12);
        }
      `}</style>
    </div>
  );
}
